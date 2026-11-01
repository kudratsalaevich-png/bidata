"""Attach currency-aware finance to existing read-only tender endpoints."""
import functools
import inspect
from collections import defaultdict
from fastapi import HTTPException


def totals(rows, finance):
    selected = {(r['market'],r['source_tender_id']) for r in rows}
    amounts, positions = defaultdict(float), defaultdict(float)
    missing = 0
    for key in selected:
        f = finance[key]
        if f['tender_amount'] is None:
            missing += 1
        else:
            amounts[f['currency']] += f['tender_amount']
    for r in rows:
        if r['source_level']=='item' and r['amount'] is not None:
            positions[r['currency']] += r['amount']
    return dict(amount=amounts.get('UZS',0), amount_currency='UZS',
                amounts_by_currency=dict(amounts),
                selected_item_amounts_by_currency=dict(positions),
                amount_scope='full_source_totals_of_matched_tenders',
                missing_tender_amounts=missing)


def register(ns):
    app, ro, dbpath = ns['app'],ns['ro'],ns['TENDER_UNIFIED_DB']
    paths = {'/api/tenders/active/summary','/api/tenders/active/grouped',
             '/api/tenders/active/top/{dim}','/api/tenders/active/detail',
             '/api/tenders/active'}
    originals = [r for r in app.routes if getattr(r,'path',None) in paths]
    if len(originals)!=len(paths):
        raise RuntimeError('Finance endpoint registration mismatch')
    for route in originals:
        original, path = route.endpoint,route.path
        # app.py uses postponed annotations; resolve them in its own namespace.
        signature = inspect.signature(original, eval_str=True)

        def factory(original, path, signature):
            @functools.wraps(original)
            def wrapped(*args, **kwargs):
                values = signature.bind(*args, **kwargs).arguments
                values = dict(values)
                with ro(dbpath) as c:
                    if not c.execute("SELECT 1 FROM sqlite_master WHERE name='fact_tender_finance'").fetchone():
                        raise HTTPException(503,'Finance database not built. Run build_tender_unified_safe.py from TENDER_FINANCE_V2.')
                    c.execute('BEGIN')
                    finance = {(r['market'],r['source_tender_id']):dict(r)
                               for r in c.execute('SELECT * FROM fact_tender_finance')}
                    filters = {k:values.get(k) for k in
                               ('market','q','subject_group','sector_group','customer','region','status')}
                    if path.endswith('/detail'):
                        where, params = 'market=? AND source_tender_id=?',[values['market'],values['tender_id']]
                        if values.get('lot_id') is not None:
                            where += " AND coalesce(source_lot_id,'')=?"
                            params.append(values['lot_id'])
                    else:
                        where,params = ns['_tender_where'](**filters)
                    rows = [dict(r) for r in c.execute('SELECT * FROM fact_tender_active WHERE '+where,params)]
                    result = original(*args, **kwargs) if not path.endswith('/top/{dim}') else []
                    if path.endswith('/summary'):
                        result.update(totals(rows,finance))
                        result['known_lots'] = len({(r['market'],r['source_tender_id'],r['source_lot_id'])
                                                  for r in rows if r['source_lot_id']})
                        result['tenders_without_lot_id'] = len({(r['market'],r['source_tender_id'])
                                                               for r in rows if not r['source_lot_id']})
                    elif path.endswith('/grouped'):
                        for item in result['items']:
                            key = item['market'],item['source_tender_id']
                            group = [r for r in rows if (r['market'],r['source_tender_id'])==key]
                            item.update(totals(group,finance))
                            f = finance[key]
                            item.update(currency=f['currency'],amount=f['tender_amount'],
                                        source_tender_amount=f['tender_amount'],
                                        all_item_amount=f['item_amount'], amount_difference=f['difference'])
                    elif path.endswith('/detail'):
                        key = values['market'],values['tender_id']
                        f = finance[key]
                        result.update(totals(rows,finance))
                        result.update(currency=f['currency'],amount=f['tender_amount'],
                                      source_tender_amount=f['tender_amount'],
                                      all_item_amount=f['item_amount'],amount_difference=f['difference'])
                        for position in result.get('positions',[]):
                            position['currency']=f['currency']
                    elif path.endswith('/top/{dim}'):
                        dim = values['dim']
                        columns = dict(subjects='subject_group',sectors='sector_group',
                                       customers='customer_name',products='product_name')
                        if dim not in columns and dim!='regions':
                            raise HTTPException(400,'Invalid dimension')
                        names=ns['TENDER_REGION_CANONICAL'] if dim=='regions' else sorted({r[columns[dim]] for r in rows if r[columns[dim]]})
                        for name in names:
                            item={'name':name}
                            if dim=='regions':
                                aliases=ns['_tender_region_aliases'](name)
                                clauses=' OR '.join("lower(coalesce(region_name,'')) LIKE lower(?)" for _ in aliases)
                                subset=[dict(r) for r in c.execute('SELECT * FROM fact_tender_active WHERE ('+where+') AND ('+clauses+')',params+aliases)]
                            else:
                                subset=[r for r in rows if r[columns[dim]]==name]
                            if not subset:
                                continue
                            item.update(totals(subset,finance))
                            item['tenders']=len({(r['market'],r['source_tender_id']) for r in subset})
                            item['rows']=len(subset)
                            result.append(item)
                        result.sort(key=lambda x:(-x['tenders'],x['name']))
                        result=result[:values.get('limit',10)]
                    else:
                        for item in result['items']:
                            item['currency']=finance[(item['market'],item['source_tender_id'])]['currency']
                    return result
            wrapped.__signature__ = signature
            return wrapped
        app.router.routes.remove(route)
        app.add_api_route(path,factory(original,path,signature),methods=['GET'])
    app.openapi_schema=None
