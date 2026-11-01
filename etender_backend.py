"""Read-only eTender views; separate routes preserve other platform handlers."""
import csv
import io
import sqlite3
from datetime import date, timedelta, datetime
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse

PREFIX = '/api/etender-v2/view'
CUSTOMER = "coalesce(nullif(trim(customer_inn_normalized),''),nullif(trim(customer_inn),''))"
PROVIDER = "coalesce(nullif(trim(provider_inn_normalized),''),nullif(trim(provider_inn),''),nullif(trim(provider_inn_enriched),''))"
CUSTOMER_NAME = "coalesce(nullif(customer_name_canonical,''),customer_name)"
PROVIDER_NAME = "coalesce(nullif(provider_name_canonical,''),provider_name)"
DISPLAY = "coalesce(nullif(trim(display_no),''),nullif(trim(display_no_enriched),''))"
TRADE = f"coalesce('t:'||trade_id,'n:'||({DISPLAY}),'d:'||deal_id)"
LABELS = {
    'deal_id':'Битим ID', 'trade_id':'Савдо ID', 'date':'Битим санаси',
    'display_no':'Савдо рақами', 'product':'Харид предмети',
    'start_cost':'Бошланғич қиймат', 'amount':'Битим суммаси',
    'currency':'Валюта', 'saving_amount':'Тежалган маблағ',
    'saving_percent':'Тежаш, %', 'participants':'Иштирокчилар сони',
    'customer':'Буюртмачи', 'customer_tin':'Буюртмачи СТИРи',
    'supplier':'Етказиб берувчи', 'provider_tin':'Етказиб берувчи СТИРи',
    'status':'Битим статуси', 'contract_status':'Шартнома статуси',
    'contract_date':'Шартнома санаси', 'treasury_status':'Ғазначилик статуси'
}
SELECT = f"""deal_id,trade_id,deal_date date,{DISPLAY} display_no,
    category_name product,start_cost,deal_cost amount,currency_name currency,
    saving_amount,saving_percent,participants_count participants,
    {CUSTOMER_NAME} customer,{CUSTOMER} customer_tin,
    {PROVIDER_NAME} supplier,{PROVIDER} provider_tin,deal_status_name status,
    deal_contract_status_name contract_status,deal_contract_date contract_date,
    deal_contract_kazna_status_name treasury_status"""

def where_for(q):
    where, params = ['currency_name=?'], [q.get('currency') or 'Сум']
    dates = {}
    for key in ('date_from','date_to'):
        if q.get(key):
            try: dates[key] = date.fromisoformat(q[key])
            except ValueError: raise HTTPException(400,'Сана формати нотўғри')
    if dates.get('date_from',date.min) > dates.get('date_to',date.max):
        raise HTTPException(400,'Бошланиш санаси тугаш санасидан кейин')
    if 'date_from' in dates:
        where.append('deal_day>=?'); params.append(dates['date_from'].isoformat())
    if 'date_to' in dates:
        where.append('deal_day<=?'); params.append(dates['date_to'].isoformat())
    if q.get('status'):
        where.append('deal_status_name=?'); params.append(q['status'])
    if q.get('q','').strip():
        term=q['q'].strip().casefold()
        # Literal substring search: percent and underscore are not wildcards.
        fields=['category_name',CUSTOMER_NAME,PROVIDER_NAME,CUSTOMER,PROVIDER,DISPLAY]
        where.append('('+' OR '.join(f'instr(CASEFOLD({f}),?)>0' for f in fields)+')')
        params.extend([term]*len(fields))
    if q.get('entity_kind'):
        kind=q['entity_kind']; value=q.get('entity_value','')
        choices={'products':'category_name','statuses':'deal_status_name',
                 'customer_tin':CUSTOMER,'provider_tin':PROVIDER,
                 'customer_name':CUSTOMER_NAME,'provider_name':PROVIDER_NAME}
        if kind not in choices or not value: raise HTTPException(400,'Кесим нотўғри')
        where.append(f'({choices[kind]})=?'); params.append(value)
    return ' AND '.join(where),params

def records_for(c,q,limit=50,offset=0):
    w,p=where_for(q)
    total=c.execute(f'SELECT count(*) FROM completed_deals WHERE {w}',p).fetchone()[0]
    rows=[dict(r) for r in c.execute(f'SELECT {SELECT} FROM completed_deals WHERE {w} ORDER BY deal_date DESC,deal_id DESC LIMIT ? OFFSET ?',p+[limit,offset])]
    return {'rows':rows,'total':total,'offset':offset,'columns':list(LABELS),'labels':LABELS}

def register_etender(app,platform,ro):
    def connection(): return ro(platform('etender')['db'])

    @app.get(PREFIX+'/meta')
    def etender_meta():
        c=connection()
        try:
            r=c.execute('SELECT min(deal_day),max(deal_day),count(*),max(updated_at) FROM completed_deals').fetchone()
            # updated_at is a row update time, not the last successful full sync.
            return {'min_date':r[0],'max_date':r[1],'rows':r[2],
                    'currencies':[r[0] for r in c.execute('SELECT DISTINCT currency_name FROM completed_deals WHERE currency_name IS NOT NULL ORDER BY currency_name')],
                    'statuses':[r[0] for r in c.execute("SELECT DISTINCT deal_status_name FROM completed_deals WHERE coalesce(deal_status_name,'')<>'' ORDER BY deal_status_name")]}
        finally: c.close()

    @app.get(PREFIX+'/data')
    def etender_data(request:Request):
        q=request.query_params; tab=q.get('tab','overview'); w,p=where_for(q)
        c=connection()
        try:
            if tab=='overview':
                r=dict(c.execute(f'''SELECT count(*) deals,count(DISTINCT {TRADE}) trades,
                    coalesce(sum(deal_cost),0) amount,avg(deal_cost) avg_amount,
                    count(DISTINCT {CUSTOMER}) customers,count(DISTINCT {PROVIDER}) providers
                    FROM completed_deals WHERE {w}''',p).fetchone())
                r['monthly']=[dict(x) for x in c.execute(f'''SELECT substr(deal_day,1,7) period,count(*) deals,
                    coalesce(sum(deal_cost),0) amount FROM completed_deals WHERE {w} GROUP BY 1 ORDER BY 1''',p)]
                r['statuses']=[dict(x) for x in c.execute(f'''SELECT deal_status_name name,count(*) deals,
                    coalesce(sum(deal_cost),0) amount FROM completed_deals WHERE {w} GROUP BY 1 ORDER BY deals DESC''',p)]
                return r
            if tab=='records':
                try: offset=max(0,int(q.get('offset','0')))
                except ValueError: raise HTTPException(400,'Саҳифа рақами нотўғри')
                return records_for(c,q,50,offset)
            if tab=='regions': return {'rows':[],'reason':'Битимлар жадвалида ҳудуд майдони мавжуд эмас. Ҳудудий таҳлил ҳозирча тайёр эмас.'}
            if tab not in ('products','customers','providers','statuses'): raise HTTPException(400,'Бўлим нотўғри')
            if tab in ('customers','providers'):
                inn=CUSTOMER if tab=='customers' else PROVIDER
                name=CUSTOMER_NAME if tab=='customers' else PROVIDER_NAME
                kind='customer' if tab=='customers' else 'provider'
                # Missing identifiers stay separated by exact canonical/raw name.
                group=f"coalesce('i:'||({inn}),'n:'||({name}))"
                name_expr=f'min({name})'; inn_expr=f'max({inn})'
            else:
                group='category_name' if tab=='products' else 'deal_status_name'
                name_expr=group; inn_expr='NULL'; kind=tab
            full=f"({w}) AND coalesce(({group}),'')<>''"
            total=c.execute(f'SELECT count(*) FROM completed_deals WHERE {w}',p).fetchone()[0]
            limit='' if tab=='statuses' else ' LIMIT 100'
            rows=[dict(x) for x in c.execute(f'''SELECT {name_expr} name,{inn_expr} inn,
                count(*) deals,count(DISTINCT {TRADE}) trades,sum(deal_cost) amount,avg(deal_cost) avg_amount
                FROM completed_deals WHERE {full} GROUP BY {group} ORDER BY amount DESC{limit}''',p)]
            for r in rows:
                r['share']=r['deals']/total*100 if total else 0
                r['entity_kind']=(kind+'_tin' if r['inn'] else kind+'_name') if tab in ('customers','providers') else kind
                r['entity_value']=r['inn'] or r['name']
            return {'rows':rows,'total_deals':total,'limited':tab!='statuses'}
        finally: c.close()

    @app.get(PREFIX+'/deal/{deal_id}')
    def etender_detail(deal_id:int):
        c=connection()
        try:
            r=c.execute(f'SELECT {SELECT} FROM completed_deals WHERE deal_id=?',(deal_id,)).fetchone()
            if not r: raise HTTPException(404,'Битим топилмади')
            return {'row':dict(r),'labels':LABELS}
        finally: c.close()

    @app.get(PREFIX+'/export')
    def etender_export(request:Request):
        q=request.query_params; c=connection()
        try:
            d=records_for(c,q,20001,0)
            if d['total']>20000: raise HTTPException(400,'Экспорт 20 000 битимгача. Сана ёки қидирув фильтрини торайтиринг.')
        finally: c.close()
        fields=list(LABELS)
        if q.get('format')=='xlsx':
            try: from openpyxl import Workbook
            except ImportError: raise HTTPException(503,'Excel экспорти учун openpyxl ўрнатилиши керак')
            book=Workbook(); sheet=book.active; sheet.title='eTender'
            sheet.append([LABELS[k] for k in fields])
            for row in d['rows']:
                for col,key in enumerate(fields,1):
                    cell=sheet.cell(sheet.max_row+1,col) if col==1 else sheet.cell(sheet.max_row,col)
                    cell.value=row.get(key)
                    if isinstance(row.get(key),str): cell.data_type='s'
                    if key in ('start_cost','amount','saving_amount','saving_percent'):
                        cell.number_format='#,##0.00'
                    if key in ('date','contract_date') and row.get(key):
                        raw=str(row[key])
                        try:
                            value=datetime.fromisoformat(raw)
                            if value.tzinfo is None:
                                cell.value=value
                                cell.number_format='DD.MM.YYYY HH:MM:SS' if key=='date' else 'DD.MM.YYYY'
                        except ValueError:
                            try:
                                cell.value=datetime.strptime(raw,'%d.%m.%Y')
                                cell.number_format='DD.MM.YYYY'
                            except ValueError: pass
            sheet.freeze_panes='A2'; sheet.auto_filter.ref=sheet.dimensions
            out=io.BytesIO(); book.save(out); out.seek(0)
            return StreamingResponse(out,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="etender_filtered.xlsx"'})
        out=io.StringIO(); writer=csv.writer(out); writer.writerow([LABELS[k] for k in fields])
        def safe(v):
            if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')): return "'"+v
            return v
        for r in d['rows']: writer.writerow([safe(r.get(k)) for k in fields])
        return StreamingResponse(iter([out.getvalue().encode('utf-8-sig')]),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':'attachment; filename="etender_filtered.csv"'})
