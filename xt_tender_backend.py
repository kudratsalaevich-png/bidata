"""Read-only XT tender view; amounts retain their original currencies."""
import csv,io,json,re
from datetime import date,datetime
from fastapi import HTTPException,Request
from fastapi.responses import StreamingResponse
PREFIX='/api/xt-view/v1'
STATUS={'open':'Очиқ','check_docs':'Ҳужжатлар текширилмоқда','close':'Муваффақиятли тарих','cancel':'Бекор қилинган','not_realized':'Амалга ошмаган'}
LABELS={'proc_id':'Тендер ID','lot_number':'Савдо рақами','publicated_at':'Эълон санаси','close_at':'Қабул тугаш санаси','name':'Тендер номи','customer_name':'Буюртмачи','customer_company_id':'Манбадаги ташкилот ID','customer_inn':'Буюртмачи СТИРи','total_amount':'Эълон қиймати','currency':'Валюта','status':'Манба статуси','record_type':'Манба ёзув тури','participant_count':'Иштирокчилар сони','source_url':'Манба ҳаволаси'}
def unpack(raw):
    try:return json.loads(raw or '{}')
    except (ValueError,TypeError):return {}
def inn(raw):
    m=unpack(raw).get('meta') or {};v=str(m.get('company_inn') or '').strip()
    return v if re.fullmatch(r'[0-9]{9}',v) else None

def register_xt_tender(app,platform,ro):
    def connection():
        c=ro(platform('xt')['db']);c.create_function('XT_INN',1,inn);c.create_function('XT_RAW_INN',1,lambda x:str((unpack(x).get('meta') or {}).get('company_inn') or ''));c.create_function('CASEFOLD',1,lambda x:str(x or '').casefold());return c
    def filters(q):
        w=['1=1'];p=[]
        for key,op in [('date_from','>='),('date_to','<=')]:
            if q.get(key):
                try:date.fromisoformat(q[key])
                except ValueError:raise HTTPException(400,'Сана нотўғри')
                w.append(f't.publicated_at {op} ?');p.append(q[key])
        if q.get('date_from') and q.get('date_to') and q['date_from']>q['date_to']:raise HTTPException(400,'Саналар тартиби нотўғри')
        for key in ('currency','status'):
            if q.get(key):w.append('t.'+key+'=?');p.append(q[key])
        if q.get('customer'):
            w.append('cast(t.customer_company_id as text)=?');p.append(q['customer'])
        if q.get('q'):
            w.append("(instr(CASEFOLD(t.name),?)>0 OR instr(CASEFOLD(t.customer_name),?)>0 OR instr(coalesce(t.lot_number,''),?)>0 OR instr(XT_RAW_INN(t.raw_master_json),?)>0 OR EXISTS(SELECT 1 FROM items i WHERE i.proc_id=t.proc_id AND (instr(CASEFOLD(i.product_name),?)>0 OR instr(coalesce(i.product_code,''),?)>0)))");p += [q['q'].strip().casefold()]*6
        if q.get('product'):
            w.append('EXISTS(SELECT 1 FROM items i WHERE i.proc_id=t.proc_id AND coalesce(i.product_name,\'\')=?)');p.append(q['product'])
        return ' AND '.join(w),p
    def records(c,q,limit=50):
        w,p=filters(q)
        try:offset=max(0,int(q.get('offset',0)))
        except ValueError:raise HTTPException(400,'Саҳифа нотўғри')
        select=','.join('t.'+k for k in LABELS if k!='customer_inn')+',XT_INN(t.raw_master_json) customer_inn'
        return [dict(r) for r in c.execute(f'SELECT {select} FROM tenders t WHERE {w} ORDER BY t.publicated_at DESC,t.proc_id DESC LIMIT ? OFFSET ?',p+[limit,offset])]
    @app.get(PREFIX+'/meta')
    def meta():
        c=connection()
        try:
            r=c.execute('SELECT count(*),min(publicated_at),max(publicated_at),sum(publicated_at is null) FROM tenders').fetchone()
            return {'rows':r[0],'min_date':r[1],'max_date':r[2],'missing_date':r[3],'currencies':[r[0] for r in c.execute('SELECT DISTINCT currency FROM tenders ORDER BY currency')],'statuses':STATUS}
        finally:c.close()
    @app.get(PREFIX+'/data')
    def data(request:Request):
        q=request.query_params;w,p=filters(q);c=connection()
        try:
            # A single currency is required for amount aggregates.
            if not q.get('currency'):raise HTTPException(400,'Валютани танланг')
            summary=dict(c.execute(f'''SELECT count(*) tenders,coalesce(sum(total_amount),0) amount,count(distinct customer_company_id) customers FROM tenders t WHERE {w}''',p).fetchone())
            monthly=[dict(r) for r in c.execute(f"SELECT substr(publicated_at,1,7) period,count(*) tenders,sum(total_amount) amount FROM tenders t WHERE {w} GROUP BY 1 ORDER BY 1",p)]
            statuses=[dict(r) for r in c.execute(f'SELECT status,count(*) tenders,sum(total_amount) amount FROM tenders t WHERE {w} GROUP BY status',p)]
            customers=[dict(r) for r in c.execute(f'''SELECT cast(customer_company_id as text) id,min(customer_name) name,min(XT_INN(raw_master_json)) inn,count(*) tenders,sum(total_amount) amount FROM tenders t WHERE {w} GROUP BY customer_company_id ORDER BY amount DESC''',p)]
            # Item totals are aggregated independently; tender totals are never repeated per item.
            products=[dict(r) for r in c.execute(f'''SELECT coalesce(i.product_name,'') name,i.currency,count(*) positions,count(distinct i.proc_id) tenders,sum(i.total_price) amount,count(i.total_price) priced FROM items i JOIN tenders t ON t.proc_id=i.proc_id WHERE {w} AND i.currency=? GROUP BY i.product_name,i.currency ORDER BY amount DESC LIMIT 100''',p+[q['currency']])]
            coverage=dict(c.execute(f'''SELECT count(*) lots,count(l.start_amount) priced_lots FROM lots l JOIN tenders t ON t.proc_id=l.proc_id WHERE {w}''',p).fetchone())
            return {'summary':summary,'monthly':monthly,'statuses':statuses,'customers':customers,'products':products,'coverage':coverage,'rows':records(c,q),'labels':LABELS}
        finally:c.close()
    @app.get(PREFIX+'/detail/{proc_id}')
    def detail(proc_id:int):
        c=connection()
        try:
            r=c.execute('SELECT * FROM tenders WHERE proc_id=?',(proc_id,)).fetchone()
            if not r:raise HTTPException(404,'Тендер топилмади')
            t=dict(r);t['customer_inn']=inn(t['raw_master_json']);t['customer_inn_raw']=str((unpack(t['raw_master_json']).get('meta') or {}).get('company_inn') or '')
            d=unpack(t['raw_detail_json']);t['contract_id']=d.get('contract_id')
            t={k:v for k,v in t.items() if not k.startswith('raw_')}
            lots=[dict(r) for r in c.execute('SELECT proc_id,lot_id,title,start_amount,currency,item_count FROM lots WHERE proc_id=? ORDER BY lot_id',(proc_id,))]
            items=[dict(r) for r in c.execute('SELECT proc_id,lot_id,item_id,product_name,product_code,category_name,quantity,unit_name,unit_price,total_price,currency,specification,delivery_period_days,guarantee_days,delivery_address FROM items WHERE proc_id=? ORDER BY lot_id,item_id',(proc_id,))]
            props=[dict(r) for r in c.execute('SELECT lot_id,item_id,prop_name,prop_value FROM item_properties WHERE proc_id=? ORDER BY lot_id,item_id,prop_name',(proc_id,))]
            return {'tender':t,'lots':lots,'items':items,'properties':props,'labels':LABELS}
        finally:c.close()
    @app.get(PREFIX+'/export')
    def export(request:Request):
        c=connection()
        try:
            w,p=filters(request.query_params)
            if c.execute(f'SELECT count(*) FROM tenders t WHERE {w}',p).fetchone()[0]>20000:raise HTTPException(400,'Экспорт 20 000 тендергача')
            q=dict(request.query_params);q['offset']='0';rows=records(c,q,20000)
        finally:c.close()
        keys=list(LABELS)
        if request.query_params.get('format')=='xlsx':
            try:from openpyxl import Workbook
            except ImportError:raise HTTPException(503,'openpyxl ўрнатилиши керак')
            wb=Workbook();s=wb.active;s.title='XT tenders';s.append(list(LABELS.values()))
            for row in rows:
                s.append([row.get(k) for k in keys])
                for col,k in enumerate(keys,1):
                    cell=s.cell(s.max_row,col)
                    if isinstance(cell.value,str):cell.data_type='s'
                    if k=='total_amount':cell.number_format='#,##0.00'
                    if k in ('publicated_at','close_at') and cell.value:
                        try:cell.value=datetime.fromisoformat(cell.value);cell.number_format='DD.MM.YYYY'
                        except ValueError:pass
            s.freeze_panes='A2';s.auto_filter.ref=s.dimensions;out=io.BytesIO();wb.save(out);out.seek(0)
            return StreamingResponse(out,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="xt_tenders.xlsx"'})
        out=io.StringIO();wr=csv.writer(out);wr.writerow(list(LABELS.values()))
        def safe(v):return "'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')) else v
        for row in rows:wr.writerow([safe(row.get(k)) for k in keys])
        return StreamingResponse(iter([out.getvalue().encode('utf-8-sig')]),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="xt_tenders.csv"'})
