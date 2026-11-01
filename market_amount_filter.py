"""Read-only per-bitim amount scope, before aggregation and LIMIT.

Only the five completed goods markets use this shared page. Dedicated tender
interfaces retain their independent amount/currency rules.
"""
import math
import re
from decimal import Decimal, InvalidOperation
from fastapi import HTTPException

SOURCES = {
    'shop': ('completed_deals', 'deal_cost', 'deal_date', 'customer_region_name'),
    'national': ('completed_deals', 'deal_cost', 'deal_date', 'customer_region_name'),
    'auction': ('completed_deals', 'contract_price', 'deal_date', 'region_name'),
    'xt_auction': ('contracts', 'contract_totalcost', 'contract_close_date', None),
    'xt_national': ('completed_lots', 'total_amount', 'close_date', 'region_name'),
}

def _numbers(minimum=None, maximum=None):
    values=[]
    for raw in (minimum, maximum):
        if raw is None or raw=='': values.append(None); continue
        try:
            number=Decimal(str(raw))
            if not number.is_finite() or number<0 or not math.isfinite(float(number)):
                raise InvalidOperation
            values.append(float(number))
        except (InvalidOperation, ValueError, OverflowError):
            raise HTTPException(422, 'Сумма манфий бўлмаган сон бўлиши керак.')
    lo,hi=values
    if lo is not None and hi is not None and lo>hi:
        raise HTTPException(422, 'Бошланғич сумма охирги суммадан катта бўлмасин.')
    return lo,hi

def bounds(key, minimum=None, maximum=None):
    lo,hi=_numbers(minimum,maximum)
    if (lo is not None or hi is not None) and key not in SOURCES:
        raise HTTPException(422, 'Бу фильтр товар ва хизматларнинг бешта савдо турига тегишли.')
    return lo,hi


def _quote(name): return '"'+name.replace('"','""')+'"'

def _scope(c,key,lo,hi,date_from,date_to,region,search=None):
    table,amount,day,region_col=SOURCES[key]
    columns={r[1] for r in c.execute('PRAGMA table_info('+_quote(table)+')')}
    required={amount,day}
    if not required<=columns:
        raise HTTPException(503, 'Манбада битим суммаси ёки сана майдони топилмади.')
    where=[];args=[]
    if lo is not None: where.append(_quote(amount)+'>=?'); args.append(lo)
    if hi is not None: where.append(_quote(amount)+'<=?'); args.append(hi)
    if date_from: where.append(_quote(day)+'>=?'); args.append(date_from[:10])
    if date_to: where.append(_quote(day)+"<date(?,'+1 day')"); args.append(date_to[:10])
    if region and region_col:
        where.append(_quote(region_col)+'=?'); args.append(region)
    elif region and key=='xt_auction':
        where.append('proc_id IN (SELECT proc_id FROM main.auction_procedures WHERE trim(region_name)=?)')
        args.append(region)
    if search and key=='xt_national':
        fields=[f for f in ('product_name','customer_name','winner_name','customer_inn','winner_inn','proc_id') if f in columns]
        where.append('('+' OR '.join('instr(CASEFOLD(coalesce(CAST('+_quote(f)+' AS TEXT),\'\')),?)>0' for f in fields)+')')
        args.extend([str(search).strip().casefold()]*len(fields))
    # Match the existing overview's completed-trade policy throughout this scope.
    if key in ('shop','national'):
        where.append('deal_status_name IN (?,?,?)')
        args.extend(('Поставлена','Поставлена (Восстановлена)','Оплачена'))
    elif key=='auction':
        where.append('status IN (?,?,?)')
        args.extend(('Поставка совершена','Поставка совершена (Восстановлена)','Оплачена'))
    elif key=='xt_auction':
        where.append("status IN ('execution_published','format_payment_success') AND proc_id IS NOT NULL")
    # Missing currency in these five markets follows the agreed UZS assumption.
    # Any explicit non-UZS or unknown currency is excluded, never converted.
    candidates=[_quote(k) for k in ('currency','currency_name','currency_code') if k in columns]
    if 'raw_json' in columns:
        for field in ('currency','currency_name','currency_code'):
            candidates.append("CASE WHEN json_valid(raw_json) THEN json_extract(raw_json,'$."+field+"') END")
    for expression in candidates:
        where.append('CASEFOLD(trim(coalesce(CAST('+expression+" AS TEXT),''))) IN ('','uzs','сум','сўм','sum','soʻm','so‘m','so’m',"+"'so''m')")
    return table, _quote(table)+' AS (SELECT * FROM main.'+_quote(table)+' WHERE '+' AND '.join(where)+')',args

def execute(c,key,lo,hi,date_from,date_to,region,sql,parameters=(),search=None):
    if lo is None and hi is None: return c.execute(sql,parameters)
    table,cte,args=_scope(c,key,lo,hi,date_from,date_to,region,search)
    # Callers are fixed, reviewed SELECTs. Do not silently return unfiltered data.
    if not re.search(r'\b(?:from|join)\s+"?'+re.escape(table)+r'\b',sql,re.I):
        raise HTTPException(500, 'Сумма фильтри бу сўровга қўлланмади.')
    query=sql.lstrip()
    if re.match(r'WITH\s+',query,re.I):
        query=re.sub(r'^WITH\s+', 'WITH '+cte+', ',query,count=1,flags=re.I)
    else: query='WITH '+cte+' '+query
    return c.execute(query,tuple(args)+tuple(parameters))

def completed_dimension(c,key,dim,limit,q,product_q,date_from,date_to,region,lo,hi):
    """Raw source path; aggregated caches cannot apply individual-deal bounds."""
    mp={'products':'product_name','categories':'category_name','regions':'customer_region_name',
        'customers':'customer_name','providers':'provider_name','statuses':'deal_status_name'}
    col=mp[dim];where=["coalesce("+col+",'')<>''"];args=[]
    if q:
        if str(q).strip().isdigit() and len(str(q).strip())>=8:
            where.append('(customer_inn LIKE ? OR provider_inn LIKE ?)');args.extend(['%'+q.strip()+'%']*2)
        else:
            where.append('CASEFOLD('+col+') LIKE CASEFOLD(?)');args.append('%'+q.strip()+'%')
    if product_q:
        if str(product_q).strip().isdigit() and len(str(product_q).strip())>=8:
            where.append('(customer_inn LIKE ? OR provider_inn LIKE ?)');args.extend(['%'+product_q.strip()+'%']*2)
        else:
            where.append('CASEFOLD(product_name) LIKE CASEFOLD(?)');args.append('%'+product_q.strip()+'%')
    columns={r[1] for r in c.execute('PRAGMA table_info(completed_deals)')}
    unit="coalesce(nullif(unit_name_enriched,''),unit_name,'')" if 'unit_name_enriched' in columns else "coalesce(unit_name,'')" if 'unit_name' in columns else "''"
    group=[col];extra=[]
    if dim in ('products','customers','providers'):
        group.extend([unit,'customer_region_name'])
        extra.extend([unit+' unit_name','customer_region_name region_name','sum(amount) quantity',
            'sum(deal_cost)/nullif(sum(amount),0) unit_price'])
    if dim in ('customers','providers'):
        inn='customer_inn' if dim=='customers' else 'provider_inn';group.append(inn);extra.append(inn+' inn')
    fields=[col+' name','count(*) deals','sum(deal_cost) amount','avg(deal_cost) avg_amount']+extra
    sql='SELECT '+','.join(fields)+' FROM completed_deals WHERE '+' AND '.join(where)+' GROUP BY '+','.join(group)+' ORDER BY amount DESC,name LIMIT ?'
    return [dict(r) for r in execute(c,key,lo,hi,date_from,date_to,region,sql,args+[limit])]

def xt_national_dimension(c,dim,limit,q,date_from,date_to,region,lo,hi):
    mp={'products':'product_name','categories':'category_name','providers':'winner_name','regions':'region_name','statuses':'status'}
    col=mp.get(dim)
    if not col:return []
    cols={r[1] for r in c.execute('PRAGMA table_info(completed_lots)')}
    if col not in cols:return []
    where=["coalesce("+col+",'')<>''"];args=[];group=col
    extra=''
    if dim=='products':
        group+=',unit_name';extra=',unit_name,sum(quantity) quantity,sum(total_amount)/nullif(sum(quantity),0) unit_price'
    if q:where.append('CASEFOLD('+col+') LIKE CASEFOLD(?)');args.append('%'+q.strip()+'%')
    sql='SELECT '+col+' name,count(distinct proc_id) deals,sum(total_amount) amount,avg(total_amount) avg_amount'+extra+' FROM completed_lots WHERE '+' AND '.join(where)+' GROUP BY '+group+' ORDER BY amount DESC,name LIMIT ?'
    return [dict(r) for r in execute(c,'xt_national',lo,hi,date_from,date_to,region,sql,args+[limit])]
