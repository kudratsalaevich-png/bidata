"""Isolated read-only MC.UZ tender analytics. No source DB writes."""
import csv
import io
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse

PREFIX = '/api/mc-view/v1'
DATES = {'confirmed': 'substr(t.confirmed_date,1,10)',
         'created': 'substr(t.created_at,1,10)',
         'winner': 'substr(t.winner_determined_date,1,10)'}
DATE_LABELS = {'confirmed': 'Тасдиқ санаси', 'created': 'Яратилиш санаси (манба)', 'winner': 'Ғолиб аниқланган сана'}
LABELS = {
 'currency':'Валюта', 'winner_id':'Ғолиб ID', 'winner_determined_date':'Ғолиб аниқланган сана', 'id':'Тендер ID', 'unique_name':'Лот рақами', 'gnk_id':'GNK рақами',
 'name':'Тендер номи', 'confirmed_date':'Тасдиқ санаси', 'created_at':'Яратилиш санаси (манба)',
 'placement_term':'Ариза қабул қилиш охири', 
 'start_price':'Бошланғич қиймат', 'winner_offer':'Ғолиб таклиф нархи', 'saving_amount':'Ҳисобланган тежам',
 'saving_pct':'Ҳисобланган тежам (%)', 'status_code':'Тендер статус коди', 'status_name':'Тендер статуси',
 'contract_status_code':'Шартнома статус коди', 'contract_status_name':'Шартнома статуси',
 'customer_name':'Буюртмачи', 'customer_inn':'Буюртмачи СТИРи', 'winner_name':'Ғолиб', 'winner_inn':'Ғолиб СТИРи',
 'region':'Объект ҳудуди', 'district':'Объект тумани', 'lot_type_name':'Иш тури', 'bidders_count':'Иштирокчилар сони'}
DETAIL_LABELS = dict(LABELS, address='Манзил', object_type='Объект тури', service_type='Хизмат тури',
 financial_source='Молиялаштириш манбаси', dastur='Дастур', soxa='Соҳа', asos='Асос', resolution='Қарор',
 complexity_category='Мураккаблик тоифаси', category_score='Тоифа', consulting_name='Консалтинг ташкилоти',
 consulting_inn='Консалтинг СТИРи', end_term_work='Ишни тугатиш муддати', end_term_work_days='Иш муддати, кун',
 discussion_start_date='Муҳокама бошланиши', discussion_end_date='Муҳокама охири', with_nds='ҚҚС белгиси (манба)',
 required_percent='Кафолат (%)', required_percent_amount='Кафолат суммаси', winner_rating='Ғолиб рейтинги',
 winner_rating_title='Рейтинг тоифаси', winner_region='Ғолиб ҳудуди', latitude='Кенглик', longitude='Узунлик',
 list_synced_at='Рўйхат синхрон санаси', detail_synced_at='Тафсилот синхрон санаси', detail_error='Тафсилот хатоси')
NOTE = ('Суммалар UZS — сўмда; ҳисобларга фақат UZS ёзувлари киради. '
        'Якунланган тендер: статус 5. Таклиф winner_doc.offer майдонидан олинади; '
        'тежам = бошланғич қиймат − таклиф, вазнли фоиз шу бошланғич қийматлар асосида ҳисобланади. '
        'Шартнома тасдиғи иш бажарилгани ёки тўловни англатмайди. Бўш нарх нол эмас. '
        'База қамрови манбанинг барча тендерлари тўлиқ йиғилганини тасдиқламайди. '
        'Номи тасдиқланмаган статуслар манба коди билан кўрсатилади.')
SUMMARY_SQL = '''COUNT(*) tenders, SUM(start_price) start_amount,
 SUM(winner_offer) offer_amount, COUNT(winner_offer) priced,
 SUM(CASE WHEN status_code IN (5) THEN 1 ELSE 0 END) completed,
 SUM(CASE WHEN status_code IN (5) THEN winner_offer END) completed_offer,
 SUM(CASE WHEN status_code IN (5) AND winner_offer IS NOT NULL THEN 1 ELSE 0 END) completed_priced,
 SUM(CASE WHEN status_code IN (5) AND winner_offer IS NOT NULL THEN saving_amount END) completed_saving,
 SUM(CASE WHEN status_code IN (5) AND winner_offer IS NOT NULL THEN start_price END) completed_priced_start,
 SUM(CASE WHEN contract_status_code=3 THEN 1 ELSE 0 END) approved_contracts,
 SUM(CASE WHEN contract_status_code=3 THEN winner_offer END) approved_offer,
 COUNT(DISTINCT NULLIF(TRIM(customer_inn),'')) customers,
 COUNT(DISTINCT CASE WHEN status_code IN (5) THEN NULLIF(TRIM(winner_inn),'') END) completed_winners'''

def filters(q):
    basis=q.get('date_basis','confirmed')
    if basis not in DATES: raise HTTPException(400,'Сана тури нотўғри')
    w=["t.currency='UZS'"]; args=[]; expr=DATES[basis]
    for key, op in [('date_from','>='),('date_to','<=')]:
        if q.get(key):
            try: date.fromisoformat(q[key])
            except ValueError: raise HTTPException(400,'Сана нотўғри')
            w.append(f'{expr} {op} ?'); args.append(q[key])
    if q.get('date_from') and q.get('date_to') and q['date_from']>q['date_to']:
        raise HTTPException(400,'Саналар тартиби нотўғри')
    for key,col in [('status','status_code'),('contract','contract_status_code'),('region','region_id'),('lot_type','lot_type_code')]:
        if q.get(key):
            if q[key]=='missing' and key=='contract': w.append('t.contract_status_code IS NULL'); continue
            try: v=int(q[key])
            except ValueError: raise HTTPException(400,'Фильтр коди нотўғри')
            w.append(f't.{col}=?'); args.append(v)
    for key,col in [('customer','customer_inn'),('winner','winner_inn')]:
        if q.get(key): w.append(f't.{col}=?'); args.append(q[key])
    if q.get('cohort'):
        if q['cohort']!='completed': raise HTTPException(400,'Тендер гуруҳи нотўғри')
        w.append('t.status_code IN (5)')
    if q.get('q','').strip():
        term=q['q'].strip().casefold()
        cols=['name','customer_name','winner_name','customer_inn','winner_inn','unique_name','gnk_id','id']
        w.append('('+' OR '.join(f'instr(CASEFOLD(t.{k}),?)>0' for k in cols)+')'); args.extend([term]*len(cols))
    return ' AND '.join(w),args,expr

def summary(c,w,args):
    d=dict(c.execute(f'SELECT {SUMMARY_SQL} FROM mc_view t WHERE {w}',args).fetchone())
    base=d['completed_priced_start']
    d['completed_saving_pct'] = d['completed_saving']/base*100 if base and d['completed_saving'] is not None else None
    return d

def records(c,q,limit=50,offset=None):
    w,args,expr=filters(q)
    if offset is None:
        try: offset=int(q.get('offset',0))
        except ValueError: raise HTTPException(400,'Саҳифа нотўғри')
    if offset<0: raise HTTPException(400,'Саҳифа нотўғри')
    cols=','.join('t.'+k for k in LABELS)
    return [dict(r) for r in c.execute(f'SELECT {cols} FROM mc_view t WHERE {w} ORDER BY {expr} DESC,t.id DESC LIMIT ? OFFSET ?',args+[limit,offset])]

def register_mc_tender(app,platform,ro):
    def connection():
        c=ro(platform('mc')['db'])
        c.create_function('CASEFOLD',1,lambda v:str(v or '').casefold())
        normalize_connection(c)
        return c
    @app.get(PREFIX+'/meta')
    def meta():
        c=connection()
        try:
            spans={k:dict(c.execute(f'SELECT MIN({e}) min_date,MAX({e}) max_date,SUM({e} IS NULL) missing FROM mc_view t').fetchone()) for k,e in DATES.items()}
            pairs=lambda col,name:[dict(r) for r in c.execute(f'SELECT {col} code,MIN({name}) name,COUNT(*) count FROM mc_view GROUP BY {col} ORDER BY {col}')]
            return {'rows':c.execute('SELECT COUNT(*) FROM mc_view').fetchone()[0], 'dates':spans,'date_labels':DATE_LABELS,
                    'statuses':pairs('status_code','status_name'), 'contracts':pairs('contract_status_code','contract_status_name'),
                    'regions':pairs('region_id','region'), 'types':pairs('lot_type_code','lot_type_name'), 'note':NOTE, 'currencies':[dict(r) for r in c.execute('SELECT currency,COUNT(*) count FROM main.tenders GROUP BY currency')]} 
        finally: c.close()
    @app.get(PREFIX+'/data')
    def data(request:Request):
        q=request.query_params;w,args,expr=filters(q);view=q.get('view','overview')
        if view not in ('overview','records','customers','winners','regions','statuses','types'): raise HTTPException(400,'Бўлим нотўғри')
        c=connection()
        try:
            c.execute('BEGIN')
            result={'summary':summary(c,w,args),'labels':LABELS,'note':NOTE}
            if view=='records':result['rows']=records(c,q)
            elif view=='overview':
                result['monthly']=[dict(r) for r in c.execute(f'''SELECT substr({expr},1,7) period,COUNT(*) tenders,SUM(start_price) start_amount,
                    SUM(CASE WHEN status_code IN (5) THEN winner_offer END) completed_offer,
                    SUM(CASE WHEN status_code IN (5) AND winner_offer IS NOT NULL THEN saving_amount END) completed_saving
                    FROM mc_view t WHERE {w} GROUP BY 1 ORDER BY 1''',args)]
            else:
                dims={'customers':('customer_inn','customer_name'),'winners':('winner_inn','winner_name'),
                      'regions':('region_id','region'),'statuses':('status_code','status_name'),'types':('lot_type_code','lot_type_name')}
                col,name=dims[view];extra=''
                if view in ('customers','winners'): extra=f" AND NULLIF(TRIM(t.{col}),'') IS NOT NULL"
                if view=='winners':extra+=' AND t.status_code IN (5)'
                result['groups']=[dict(r) for r in c.execute(f'''SELECT CAST({col} AS TEXT) id,MIN({name}) name,{SUMMARY_SQL}
                    FROM mc_view t WHERE {w}{extra} GROUP BY {col} ORDER BY {'completed_offer' if view=='winners' else 'start_amount'} DESC LIMIT 100''',args)]
                result['group_count']=c.execute(f'SELECT COUNT(*) FROM (SELECT 1 FROM mc_view t WHERE {w}{extra} GROUP BY {col})',args).fetchone()[0]
            return result
        finally:c.close()
    @app.get(PREFIX+'/detail/{tender_id}')
    def detail(tender_id:int):
        c=connection()
        try:
            c.execute('BEGIN');r=c.execute('SELECT * FROM mc_view WHERE id=?',(tender_id,)).fetchone()
            if not r:raise HTTPException(404,'Тендер топилмади')
            t={k:v for k,v in dict(r).items() if not k.startswith('raw_')}
            files=[dict(r) for r in c.execute('SELECT type source_kind,file_url,file_name,type file_type,role,created_at FROM tender_files WHERE tender_id=? ORDER BY id',(tender_id,))]
            processes=[dict(r) for r in c.execute('SELECT DISTINCT status action,seen_at created_at,NULL end_date FROM tender_status_history WHERE tender_id=? ORDER BY seen_at,status',(tender_id,))]
            items=[dict(r) for r in c.execute('SELECT product_name,quantity,unit_name,unit_price,total_price FROM tender_items WHERE tender_id=? ORDER BY id',(tender_id,))]
            return {'tender':t,'files':files,'process':processes,'items':items,'labels':DETAIL_LABELS,'note':NOTE}
        finally:c.close()
    @app.get(PREFIX+'/export')
    def export(request:Request):
        q=request.query_params;w,args,_=filters(q)
        if q.get('format','csv') not in ('csv','xlsx'):raise HTTPException(400,'Экспорт формати нотўғри')
        c=connection()
        try:
            c.execute('BEGIN');n=c.execute(f'SELECT COUNT(*) FROM mc_view t WHERE {w}',args).fetchone()[0]
            if n>20000:raise HTTPException(400,f'Фильтрда {n} та тендер бор. Экспорт 20 000 тагача; сана ёки ташкилотни танланг.')
            rows=records(c,q,limit=20000,offset=0)
        finally:c.close()
        keys=list(LABELS)
        if q.get('format')=='xlsx':
            try:from openpyxl import Workbook
            except ImportError:raise HTTPException(503,'openpyxl ўрнатилиши керак')
            wb=Workbook();s=wb.active;s.title='MC tenders';s.append(list(LABELS.values()))
            for row_index,row in enumerate(rows,2):
                s.append([row.get(k) for k in keys])
                for i,k in enumerate(keys,1):
                    cell=s.cell(row_index,i)
                    if isinstance(cell.value,str):cell.data_type='s'
                    if k in ('start_price','winner_offer','saving_amount','saving_pct'):cell.number_format='#,##0.00'
                    if k in ('created_at','confirmed_date','transaction_date','placement_term') and cell.value:
                        try:
                            dt=datetime.fromisoformat(cell.value.replace('Z','+00:00'))
                            if dt.tzinfo:dt=dt.astimezone(timezone(timedelta(hours=5))).replace(tzinfo=None)
                            cell.value=dt;cell.number_format='DD.MM.YYYY HH:MM'
                        except ValueError:pass
            s.freeze_panes='A2';s.auto_filter.ref=s.dimensions
            notes=wb.create_sheet('Изоҳ');notes.append(['Сана тури',DATE_LABELS[q.get('date_basis','confirmed')]])
            notes.append(['Изоҳ',NOTE]);notes.append(['Фильтр',str(dict(q))])
            out=io.BytesIO();wb.save(out);out.seek(0)
            return StreamingResponse(out,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="mc_tenders.xlsx"'})
        def safe(v):return "'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')) else v
        out=io.StringIO();wr=csv.writer(out);wr.writerow(list(LABELS.values()))
        for r in rows:wr.writerow([safe(r.get(k)) for k in keys])
        return StreamingResponse(iter([out.getvalue().encode('utf-8-sig')]),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="mc_tenders.csv"'})


def normalize_connection(c):
    import math
    def number(v):
        if v is None or isinstance(v,bool):return None
        try:
            x=float(v)
            return x if math.isfinite(x) else None
        except (ValueError,TypeError):return None
    c.create_function('MC_NUMBER',1,number,deterministic=True)
    c.create_function('MC_STATUS',1,lambda v:'Якунланган' if str(v)=='5' else 'Статус '+str(v),deterministic=True)
    contracts={1:'Шартнома юборилмаган',2:'Шартнома текширувда',3:'Шартнома тасдиқланган',4:'Шартнома рад этилган',5:'Ғазначилик текширувида',6:'Ғазначилик рад этган'}
    c.create_function('MC_CONTRACT',1,lambda v:contracts.get(v,'Статус '+str(v)) if v is not None else None,deterministic=True)
    c.execute('PRAGMA query_only=OFF')
    try:c.executescript(NORMAL_VIEW)
    finally:c.execute('PRAGMA query_only=ON')

NORMAL_VIEW = """
CREATE TEMP VIEW mc_view AS
WITH source AS (
 SELECT *,CASE WHEN json_valid(raw_json) THEN raw_json ELSE '{}' END j FROM main.tenders
), parsed AS (
 SELECT *, MC_NUMBER(json_extract(j,'$.winner_doc.offer')) winner_offer,
 CAST(json_extract(j,'$.shartnoma_status') AS INTEGER) contract_status_code,
 CAST(json_extract(j,'$.winner.inn') AS TEXT) winner_inn,
 json_extract(j,'$.winner.name') winner_name
 FROM source
)
SELECT id,unique_name,gnk_id,name,currency,winner_id,winner_determined_date,
 CAST(status AS INTEGER) status_code,MC_STATUS(status) status_name,
 contract_status_code,MC_CONTRACT(contract_status_code) contract_status_name,
 lot_type lot_type_code,'Иш тури '||lot_type lot_type_name,
 start_price,winner_offer,
 CASE WHEN winner_offer IS NOT NULL THEN start_price-winner_offer END saving_amount,
 CASE WHEN start_price>0 AND winner_offer IS NOT NULL THEN (start_price-winner_offer)/start_price*100 END saving_pct,
 confirmed_date,created_at,placement_term,
 region_id,COALESCE(NULLIF(region_name_uz,''),region_name) region,
 COALESCE(NULLIF(district_name_uz,''),district_name) district,
 customer_name,customer_inn,winner_name,winner_inn,bidders_count,
 address,object_type_name object_type,service_type_name service_type,
 financial_source_name financial_source,program_name dastur,soxa_name soxa,
 complexity_category_name complexity_category,category_score_name category_score,
 consulting_name,consulting_inn,end_term_work,end_term_work_days,with_nds,
 required_percent,required_percent_amount,latitude,longitude,
 last_seen_at list_synced_at,last_detail_sync_at detail_synced_at,
 NULL detail_error,NULL winner_rating,NULL winner_rating_title,NULL winner_region,
 NULL asos,NULL resolution,NULL discussion_start_date,NULL discussion_end_date,public_url
FROM parsed;
"""
