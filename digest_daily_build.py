"""Read-only daily procurement digest; archived snapshots are immutable by default."""
import argparse, json, re, sqlite3, os, uuid
from collections import defaultdict
from contextlib import closing
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

TZ=timezone(timedelta(hours=5))
MARKETS={
 'shop':('UZEX · Электрон дўкон','shop_completed_deals.sqlite3','completed_deals','deal_date'),
 'national':('UZEX · Миллий дўкон','national_completed_deals.sqlite3','completed_deals','deal_date'),
 'auction':('UZEX · Аукцион','auction_completed_deals.sqlite3','completed_deals','deal_date'),
 'xt_auction':('XT · Аукцион','xt_auction_completed.sqlite3','contracts','contract_close_at'),
 'xt_national':('XT · Миллий дўкон','xt_national_completed.sqlite3','completed_lots','close_date'),
 'etender':('UZEX · eTender','etender_completed_deals.sqlite3','completed_deals','deal_date'),
 'xt':('XT · Тендер','xt_xarid_tenders.sqlite3','tenders',None),
 'shaffof':('Shaffof · Тендер','shaffof_tenders.sqlite3','tenders',None),
 'mc':('MC.UZ · Тендер','mc_tenders.sqlite3','tenders','winner_determined_date')}
UNITS={'шт':'dona','шт.':'dona','дона':'dona','штука':'dona','pcs':'dona','кг':'kg','килограмм':'kg','м':'metr','метр':'metr','л':'litr','литр':'litr','м2':'m2','м²':'m2','м3':'m3','м³':'m3','т':'tonna','тонна':'tonna','комплект':'komplekt'}
def text(v):return ' '.join(str(v if v is not None else '').split())
def qi(s):return '"'+s.replace('"','""')+'"'
def dec(v):
 try:
  x=Decimal(str(v));return x if x.is_finite() and x>=0 else None
 except (ValueError,TypeError,InvalidOperation):return None
def raw(v):
 try:
  x=json.loads(v or '{}');return x if isinstance(x,dict) else {}
 except (ValueError,TypeError):return {}
def stamp(v):
 s=text(v).replace('(Asia/Tashkent)','').strip()
 if not s:return None
 try:d=datetime.fromisoformat(s.replace('Z','+00:00'))
 except ValueError:
  d=None
  for f in ('%d.%m.%Y %H:%M:%S','%d.%m.%Y %H:%M','%d.%m.%Y'):
   try:d=datetime.strptime(s,f);break
   except ValueError:pass
  if d is None:return None
 return d.astimezone(TZ) if d.tzinfo else d.replace(tzinfo=TZ)
def currency(*objects,default=False):
 mapping={'uzs':'UZS','860':'UZS','сум':'UZS','сўм':'UZS','som':'UZS','usd':'USD','840':'USD','доллар':'USD','eur':'EUR','978':'EUR','евро':'EUR','rub':'RUB','643':'RUB','рубль':'RUB','cny':'CNY','156':'CNY','юань':'CNY'}
 found=set();unknown=False
 for o in objects:
  for f in ('currency','currency_name','currency_code'):
   v=text(o.get(f)).casefold()
   if not v:continue
   if v in mapping:found.add(mapping[v])
   else:unknown=True
 if unknown or len(found)>1:return None,False
 return (next(iter(found)),False) if found else (('UZS',True) if default else (None,False))
def ro(p):
 c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True,timeout=30);c.row_factory=sqlite3.Row;c.execute('PRAGMA query_only=ON');return c
def columns(c,t):return {r[1] for r in c.execute('PRAGMA table_info('+qi(t)+')')}
def org(name,tin,market):
 n=re.sub(r'\D','',text(tin));name=text(name)
 if len(n)==9:return {'key':'inn:'+n,'name':name or n,'inn':n}
 return {'key':market+':name:'+name.casefold(),'name':name,'inn':None} if name else None
def products_for(c,m,r):
 if m in ('shop','national'):
  return [{'name':r.get('product_name'),'quantity':r.get('amount'),'unit':r.get('unit_name') or r.get('unit_name_enriched'),'category':r.get('category_name')}]
 if m=='auction':
  return [{'name':i['product_name'],'quantity':i['quantity'],'unit':i['unit_name'],'category':i['category_name']} for i in c.execute('SELECT * FROM auction_products WHERE completed_deal_id=?',(r['id'],))]
 if m=='xt_auction':
  # Contract-to-item allocation is ambiguous when one procedure has several contracts.
  if c.execute('SELECT count(*) FROM contracts WHERE proc_id=?',(r.get('proc_id'),)).fetchone()[0]!=1:return []
  return [{'name':i['product_name'],'quantity':i['quantity'],'unit':i['unit_name'],'category':i['category_name']} for i in c.execute('SELECT * FROM auction_items WHERE proc_id=?',(r.get('proc_id'),))]
 if m=='xt_national':return [{'name':r.get('product_name'),'quantity':r.get('quantity'),'unit':r.get('unit_name'),'category':r.get('category_name')}]
 # Tender plan items are planned quantities, not evidence of quantities actually sold.
 return []

def freshness(c,t,day,m):
 cols=columns(c,t);values={}
 for f in ('last_seen_at','updated_at','detail_synced_at','last_detail_sync_at','list_synced_at'):
  if f in cols:values[f]=c.execute('SELECT max('+qi(f)+') FROM '+qi(t)).fetchone()[0]
 parsed=[stamp(v) for v in values.values()];parsed=[v for v in parsed if v]
 latest=max(parsed) if parsed else None
 covered=False
 # Require bounds through next midnight, fetched AFTER the whole day.
 # A stored 23:59:00 end does not prove that the last 59 seconds were covered.
 if m in ('shop','national') and {'date_from','date_to','status','updated_at'}<=columns(c,'sync_intervals'):
  start=datetime.combine(day,datetime.min.time(),TZ);end=start+timedelta(days=1);ranges=[]
  for r in c.execute("SELECT date_from,date_to,updated_at FROM sync_intervals WHERE status='complete'"):
   lo,hi,updated=(stamp(v) for v in r)
   if lo and hi and updated and updated>=end and hi>=start and lo<end:ranges.append((lo,hi))
  cursor=start
  for lo,hi in sorted(ranges):
   if lo>cursor:break
   cursor=max(cursor,hi)
  covered=cursor>=end
 return {'last_observed_update':latest.isoformat() if latest else None,'coverage':'COMPLETE_INTERVALS' if covered else 'UNVERIFIED','stale':latest is None or latest.date()<day+timedelta(days=1),'update_fields':values}

def market_data(root,m,day):
 title,filename,table,field=MARKETS[m];base={'market':m,'title':title,'date':day.isoformat(),'deals_count':None,'amounts_by_currency':{},'top_deals':{},'top_products':[],'top_categories':[],'top_regions':[],'top_customers':[],'top_suppliers':[],'included':False,'status':'UNAVAILABLE','notes':[]}
 p=root/filename
 if not p.is_file():base['notes']=['Манба базаси топилмади.'];return base,[]
 if not field:
  base['status']='EVENT_UNVERIFIED'
  base['notes']=['Натижа санаси тасдиқланмаган; умумий ҳисобга қўшилмади.']
  if m=='shaffof':base['notes'].append('MC билан мос тендерлар такрор саналмайди. transaction_date муҳокама тугаш санаси билан мос келади.')
  return base,[]
 try:
  with closing(ro(p)) as c:
   if field not in columns(c,table):raise ValueError('event field missing')
   base.update(freshness(c,table,day,m))
   # Widen only UTC-backed contracts so local-day boundary rows remain included.
   lo=(day-timedelta(days=1)).isoformat() if m=='xt_auction' else day.isoformat()
   hi=(day+timedelta(days=2)).isoformat() if m=='xt_auction' else (day+timedelta(days=1)).isoformat()
   rows=[dict(r) for r in c.execute('SELECT * FROM '+qi(table)+' WHERE '+qi(field)+'>=? AND '+qi(field)+'<?',(lo,hi))]
   rows=[r for r in rows if stamp(r.get(field)) and stamp(r[field]).date()==day]
   events={};invalid=0;conflicts=0
   for r in rows:
    j=raw(r.get('raw_json'));cc,assumed=currency(r,j,default=m in ('shop','national','auction','xt_auction','xt_national'))
    if m in ('shop','national','etender'):
     key=text(r.get('deal_id'));amount=dec(r.get('deal_cost'));lot=text(r.get('lot_display_no') or r.get('display_no_enriched') or r.get('display_no') or r.get('lot_id') or r.get('trade_id'))
     buyer=org(r.get('customer_name'),r.get('customer_inn_normalized') or r.get('customer_inn'),m);seller=org(r.get('provider_name'),r.get('provider_inn_normalized') or r.get('provider_inn'),m)
    elif m=='auction':
     key=text(r.get('deal_id'));amount=dec(r.get('contract_price'));lot=text(r.get('lot_number') or r.get('lot_id'))
     objects=[r,j]
     for product in c.execute('SELECT raw_json FROM auction_products WHERE completed_deal_id=?',(r['id'],)):
      detail=raw(product[0]);objects.append(detail)
      if isinstance(detail.get('completed_product'),dict):objects.append(detail['completed_product'])
     cc,assumed=currency(*objects,default=True)
     buyer=org(r.get('customer_name'),r.get('customer_tin'),m);seller=org(r.get('provider_name'),r.get('provider_tin'),m)
    elif m=='xt_auction':
     key=text(r.get('contract_id'));amount=dec(r.get('contract_totalcost'));lot=text(r.get('contract_number') or r.get('proc_id'))
     buyer=org(r.get('org_company_title'),r.get('org_inn'),m);seller=org(r.get('winner_company_title'),r.get('winner_inn'),m)
    elif m=='xt_national':
     key=text(r.get('contract_id') or r.get('proc_id'));amount=dec(r.get('total_amount'));lot=text(r.get('proc_id'))
     buyer_info=raw(r.get('buyer_info_json'));seller_info=raw(r.get('seller_info_json'))
     buyer=org(buyer_info.get('company_title') or buyer_info.get('name'),buyer_info.get('inn'),m);seller=org(r.get('winner_name') or seller_info.get('company_title'),seller_info.get('inn'),m)
    else:
     key=text(r.get('id'));winner=j.get('winner_doc') or {};winner=winner if isinstance(winner,dict) else {}
     amount=dec(winner.get('offer'));lot=text(r.get('lotid') or r.get('unique_name') or r.get('id'))
     buyer=org(r.get('customer_name'),r.get('customer_inn'),m);seller=None
     base['notes']=['MC: кун ғолиб аниқланган сана бўйича; сумма ғолиб таклифи. Shaffof алоҳида қўшилмайди.']
    if not key:invalid+=1;continue
    item={'key':m+':'+key,'market':m,'lot':lot or key,'amount':amount,'currency':cc,'assumed_uzs':assumed,'buyer':buyer,'seller':seller,'region':text(r.get('customer_region_name') or r.get('region_name') or r.get('region_name_uz')),'category':text(r.get('category_name')),'products':[]}
    if key in events:
     old=events[key]
     if old['amount']!=amount or old['currency']!=cc:old['amount']=None;old['currency']=None;conflicts+=1
     old['products'].extend(products_for(c,m,r));continue
    item['products']=products_for(c,m,r);events[key]=item
   events=list(events.values());base['invalid_identity_rows']=invalid;base['conflicting_amount_rows']=conflicts
   base['status']='OBSERVED' if events else ('EMPTY_COVERED' if base['coverage']=='COMPLETE_INTERVALS' else 'NO_VERIFIED_DATA')
   if base['stale']:base['notes'].append('Манбанинг кун якунидан кейин янгилангани тасдиқланмаган.')
   if base['coverage']!='COMPLETE_INTERVALS':base['notes'].append('Кун тўлиқ қамраб олингани тасдиқланмаган; базадаги мавжуд ёзувлар кўрсатилди.')
   if m=='xt_national':
    latest=c.execute('SELECT max(close_date) FROM completed_lots').fetchone()[0];base['latest_event_date']=latest
    if latest and latest<day.isoformat() and base['stale']:base['notes'].append('Савдо ёзувлари '+latest+' санасида қолган. Янги синхронизация ишга тушиши янги савдолар олинганини исботламайди.')
   if events or base['coverage']=='COMPLETE_INTERVALS':
    base.update(summarize(events));base['deals_count']=len(events);base['included']=True
   return base,events
 except (sqlite3.Error,ValueError,KeyError) as e:
  base['notes']=['Манба ўқишда хатолик: '+str(e)];base['status']='ERROR';return base,[]

def summarize(events):
 amounts=defaultdict(Decimal);priced=defaultdict(int);tops=defaultdict(list);unpriced=0;assumed=0
 buyers={};sellers={};groups={};categories=defaultdict(set);regions=defaultdict(set)
 for e in events:
  if e['buyer']:buyers[e['buyer']['key']]=e['buyer']
  if e['seller']:sellers[e['seller']['key']]=e['seller']
  if e['amount'] is not None and e['currency']:
   amounts[e['currency']]+=e['amount'];priced[e['currency']]+=1;assumed+=e['assumed_uzs']
   tops[e['currency']].append({'lot':e['lot'],'market':e['market'],'contract':str(e['amount']),'currency':e['currency'],'customer':e['buyer']['name'] if e['buyer'] else '', 'supplier':e['seller']['name'] if e['seller'] else ''})
  else:unpriced+=1
  if e['category']:categories[e['category']].add(e['key'])
  if e['region']:regions[e['region']].add(e['key'])
  for p in e['products']:
   name=text(p.get('name'));unit=text(p.get('unit')).casefold();unit=UNITS.get(unit,unit);quantity=dec(p.get('quantity'))
   if p.get('category'):categories[text(p['category'])].add(e['key'])
   if not name:continue
   # Missing unit does not make quantities comparable.
   if not unit or quantity is None or quantity<=0:continue
   key=(e['market'],name.casefold(),unit)
   g=groups.setdefault(key,{'name':name,'unit_name':unit,'market':e['market'],'quantity':Decimal(0),'deals':set()})
   g['quantity']+=quantity;g['deals'].add(e['key'])
 def top_counts(group):return [{'name':k,'deals_count':len(v)} for k,v in sorted(group.items(),key=lambda x:(-len(x[1]),x[0]))[:3]]
 def top_org(which,known):
  counts=defaultdict(set)
  for e in events:
   if e[which]:counts[e[which]['key']].add(e['key'])
  return [{'name':known[k]['name'],'inn':known[k]['inn'],'deals_count':len(v)} for k,v in sorted(counts.items(),key=lambda x:(-len(x[1]),x[0]))[:3]]
 product_rows=[{'name':g['name'],'market':g['market'],'unit_name':g['unit_name'],'quantity':str(g['quantity']),'deals_count':len(g['deals'])} for g in groups.values()]
 product_rows.sort(key=lambda x:(-Decimal(x['quantity']),x['name'],x['unit_name']))
 return {'amounts_by_currency':{cc:str(v.quantize(Decimal('.01'))) for cc,v in sorted(amounts.items())},'priced_deals_by_currency':dict(priced),'average_by_currency':{cc:str((amounts[cc]/priced[cc]).quantize(Decimal('.01'))) for cc in amounts},'unpriced_deals':unpriced,'assumed_uzs_deals':assumed,'customers_count':len(buyers),'suppliers_count':len(sellers),'participant_count_note':'СТИР бўйича такрорлар олиб ташланган; СТИРсиз номлар ҳар бозор ичида ҳисобланган.','top_deals':{cc:sorted(rows,key=lambda r:-Decimal(r['contract']))[:3] for cc,rows in tops.items()},'top_products':product_rows[:3],'top_categories':top_counts(categories),'top_regions':top_counts(regions),'top_customers':top_org('buyer',buyers),'top_suppliers':top_org('seller',sellers)}

def build(root,day):
 from digest_construction_events import construction_markets
 construction=construction_markets(root,day,globals())
 construction_previous=construction_markets(root,day-timedelta(days=1),globals())
 markets={};all_events=[];previous=[];previous_markets={}
 for m in MARKETS:
  d,events=construction[m] if m in construction else market_data(root,m,day);markets[m]=d;all_events.extend(events)
  prev,p_events=construction_previous[m] if m in construction_previous else market_data(root,m,day-timedelta(days=1));previous_markets[m]=prev;previous.extend(p_events)
 summary=summarize(all_events);summary['deals_count']=len(all_events)
 prev_summary=summarize(previous)
 # Percentage comparisons require full-day coverage for BOTH days and equal scope.
 covered=[m for m in MARKETS if markets[m].get('coverage')=='COMPLETE_INTERVALS' and previous_markets[m].get('coverage')=='COMPLETE_INTERVALS']
 summary['comparable_markets']=covered
 summary['deals_change_pct']=None
 if covered and all(not markets[m]['included'] or m in covered for m in MARKETS):
  before=sum(previous_markets[m]['deals_count'] or 0 for m in covered);now=sum(markets[m]['deals_count'] or 0 for m in covered)
  if before:summary['deals_change_pct']=round((now-before)/before*100,2)
 summary['partial']=any(not d['included'] or d.get('coverage')!='COMPLETE_INTERVALS' for d in markets.values())
 return {'schema_version':3,'date':day.isoformat(),'generated_at':datetime.now(TZ).isoformat(),'publication_time':'09:00 Asia/Tashkent','markets':markets,'summary':summary,'previous_summary':prev_summary,'policy':{'status_filter':False,'missing_currency_uzs':'Only five non-tender markets; user-approved assumption, explicit other currency preserved.','event_dates':'Deal date / contract close timestamp / winner determined date. No deadline-based tender results.','mc_shaffof':'Shaffof award process event preferred; matched MC records counted once, MC-only dated awards included. Ambiguous award histories withheld. Shaffof currency inherited only from verified matching MC tender or explicit source currency.','timezone':'Explicit UTC converted to Tashkent. Naive source clocks interpreted as Tashkent; source convention remains unverified.'}}

def main():
 a=argparse.ArgumentParser();a.add_argument('--data-dir',default=r'C:\Qudrat\xarid_uz\UZBI\data');a.add_argument('--site',required=True);a.add_argument('--date');a.add_argument('--publish',action='store_true');args=a.parse_args()
 now=datetime.now(TZ);day=date.fromisoformat(args.date) if args.date else now.date()-timedelta(days=1)
 if day>=now.date():a.error('Only completed calendar days are allowed')
 if args.publish and not args.date and now.hour<9:raise SystemExit('WAIT: publication starts at 09:00 Tashkent')
 folder=Path(args.site)/'data/daily_digest';folder.mkdir(parents=True,exist_ok=True)
 out=folder/(day.isoformat()+'.json' if args.publish else day.isoformat()+'.preview.json')
 if args.publish and out.exists():print('ARCHIVE EXISTS: unchanged',out);return
 data=build(Path(args.data_dir),day)
 if not any(d['included'] for d in data['markets'].values()):raise SystemExit('STOP: no readable daily results; old archive preserved')
 tmp=out.with_name(out.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 # Never replace an existing published snapshot, including competing runs.
 if args.publish:
  try:os.link(tmp,out)
  except FileExistsError:tmp.unlink();print('ARCHIVE EXISTS: unchanged',out);return
  except OSError as e:raise SystemExit('STOP: atomic publication unavailable; completed candidate retained at '+str(tmp)+'; '+str(e))
  tmp.unlink()
 else:tmp.replace(out)
 print('DIGEST OK:',day,'| observed deals:',data['summary']['deals_count'],'| partial:',data['summary']['partial']);print('OUTPUT:',out)
if __name__=='__main__':main()
