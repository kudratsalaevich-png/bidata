#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, HTTPException

router = APIRouter(prefix="/api/product-codes", tags=["product-codes"])

UZBI_DATA = Path(r"C:\Qudrat\xarid_uz\UZBI\data")
DB_PATH = UZBI_DATA / "product_codes.sqlite3"


def _connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Product catalog DB not found: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=5000")
    return con


def _digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def _formatted_code(code: str) -> str:
    s = _digits(code)
    if len(s) == 14:
        return f"{s[0:2]}.{s[2:4]}.{s[4:6]}.{s[6:9]}_{s[9:14]}"
    return code


def _alias_table_exists(con: sqlite3.Connection) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='product_code_aliases_xt_national'"
    ).fetchone() is not None


@router.get("")
def list_product_codes(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    con = _connect()
    try:
        total = con.execute("SELECT COUNT(*) FROM product_codes").fetchone()[0]
        rows = con.execute(
            """
            SELECT id, product_code, category_name, product_name,
                   first_lot_id, last_lot_id, first_seen_at, last_seen_at, updated_at
            FROM product_codes
            ORDER BY product_name COLLATE NOCASE, product_code
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()

        items = []
        for r in rows:
            code = str(r["product_code"] or "")
            items.append({
                "id": r["id"],
                "product_code": code,
                "display_code": _formatted_code(code),
                "category_name": r["category_name"],
                "product_name": r["product_name"],
                "first_lot_id": r["first_lot_id"],
                "last_lot_id": r["last_lot_id"],
                "first_seen_at": r["first_seen_at"],
                "last_seen_at": r["last_seen_at"],
                "updated_at": r["updated_at"],
            })
        return {"total": total, "limit": limit, "offset": offset, "items": items}
    finally:
        con.close()


@router.get("/search")
def search_product_codes(
    q: str = Query(..., min_length=1),
    limit: int = Query(30, ge=1, le=100),
) -> List[Dict[str, Any]]:
    query = " ".join((q or "").strip().split())
    digits = _digits(query)
    like = f"%{query}%"
    dlike = f"%{digits}%"

    con = _connect()
    try:
        has_alias = _alias_table_exists(con)

        if has_alias:
            sql = """
            WITH alias_agg AS (
                SELECT product_code,
                       GROUP_CONCAT(alias_name, ' || ') AS aliases
                FROM product_code_aliases_xt_national
                GROUP BY product_code
            )
            SELECT p.id, p.product_code, p.category_name, p.product_name,
                   COALESCE(a.aliases, '') AS aliases,
                   CASE
                     WHEN p.product_code = ? THEN 100
                     WHEN p.product_code LIKE ? THEN 90
                     WHEN LOWER(p.product_name) = LOWER(?) THEN 85
                     WHEN LOWER(p.product_name) LIKE LOWER(?) THEN 75
                     WHEN LOWER(COALESCE(a.aliases,'')) LIKE LOWER(?) THEN 65
                     ELSE 10
                   END AS score
            FROM product_codes p
            LEFT JOIN alias_agg a ON a.product_code = p.product_code
            WHERE p.product_code LIKE ?
               OR LOWER(p.product_name) LIKE LOWER(?)
               OR LOWER(COALESCE(a.aliases,'')) LIKE LOWER(?)
            ORDER BY score DESC, p.product_name COLLATE NOCASE, p.product_code
            LIMIT ?
            """
            params = (
                digits, dlike, query, like, like,
                dlike, like, like, limit
            )
        else:
            sql = """
            SELECT p.id, p.product_code, p.category_name, p.product_name,
                   '' AS aliases,
                   CASE
                     WHEN p.product_code = ? THEN 100
                     WHEN p.product_code LIKE ? THEN 90
                     WHEN LOWER(p.product_name) = LOWER(?) THEN 85
                     WHEN LOWER(p.product_name) LIKE LOWER(?) THEN 75
                     ELSE 10
                   END AS score
            FROM product_codes p
            WHERE p.product_code LIKE ?
               OR LOWER(p.product_name) LIKE LOWER(?)
            ORDER BY score DESC, p.product_name COLLATE NOCASE, p.product_code
            LIMIT ?
            """
            params = (digits, dlike, query, like, dlike, like, limit)

        rows = con.execute(sql, params).fetchall()

        out = []
        for r in rows:
            aliases = [x.strip() for x in (r["aliases"] or "").split(" || ") if x.strip()]
            code = str(r["product_code"] or "")
            out.append({
                "id": r["id"],
                "product_code": code,
                "display_code": _formatted_code(code),
                "product_name": r["product_name"],
                "category_name": r["category_name"],
                "aliases": aliases[:20],
                "score": r["score"],
            })
        return out
    finally:
        con.close()


@router.get("/{product_code}")
def get_product_code(product_code: str) -> Dict[str, Any]:
    can = _digits(product_code)
    con = _connect()
    try:
        row = con.execute(
            """
            SELECT id, product_code, category_name, product_name,
                   first_lot_id, last_lot_id, first_seen_at, last_seen_at, updated_at
            FROM product_codes
            WHERE product_code = ?
            """,
            (can,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product code not found")

        aliases = []
        if _alias_table_exists(con):
            aliases = [
                r[0] for r in con.execute(
                    """
                    SELECT alias_name
                    FROM product_code_aliases_xt_national
                    WHERE product_code = ?
                    ORDER BY alias_name COLLATE NOCASE
                    """,
                    (can,),
                )
            ]

        code = str(row["product_code"] or "")
        return {
            "id": row["id"],
            "product_code": code,
            "display_code": _formatted_code(code),
            "category_name": row["category_name"],
            "product_name": row["product_name"],
            "aliases": aliases,
            "first_lot_id": row["first_lot_id"],
            "last_lot_id": row["last_lot_id"],
            "first_seen_at": row["first_seen_at"],
            "last_seen_at": row["last_seen_at"],
            "updated_at": row["updated_at"],
        }
    finally:
        con.close()
