"""Build yesterday's quantity ticker from five read-only source databases."""
import argparse, json, os, re, sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

TZ=timezone(timedelta(hours=5))
TITLES={'shop':'Электрон дўкон','national':'Миллий дўкон','auction':'UZEX аукцион',
        'xt_auction':'XT аукцион','xt_national':'XT миллий дўкон'}
FILES={'shop':'shop_completed_deals.sqlite3','national':'national_completed_deals.sqlite3',
       'auction':'auction_completed_deals.sqlite3','xt_auction':'xt_auction_completed.sqlite3',
       'xt_national':'xt_national_completed.sqlite3'}
ALIASES={'dona':('шт','шт.','дона','dona','штука','штук','штуки','pcs'),
 'kg':('кг','kg','килограмм'),'litr':('л','литр','litr'),
 'metr':('м','метр','metr','пог. м','пог. метр','погон. м'),
 'm2':('м²','м2','м^2','m2','кв. метр','кв.метр'),
 'm3':('м³','м3','м^3','m3','куб. метр','куб.м'),
 'tonna':('т','тонна','tonna'),'komplekt':('комплект','компл.'),
 'pachka':('пач','пачк','пачка'),'qadoq':('уп.','упак','упак.'),
 'flakon':('флак','флакон'),'juft':('пар','пара'),'rulon':('рул','рулон')}
UNITMAP={s:u for u,ss in ALIASES.items() for s in ss}

def text(v):return ' '.join(str(v or '').split())
def num(v):
 try:
  n=Decimal(str(v));return n if n.is_finite() else None
 except (InvalidOperation,ValueError,TypeError):return None
def raw(v):
 try:
  o=json.loads(v or '{}');return o if isinstance(o,dict) else {}
 except (ValueError,TypeError):return {}
def currency(v):
 s=text(v).casefold()
 return {'uzs':'UZS','860':'UZS','сум':'UZS','сўм':'UZS','som':'UZS',
 'usd':'USD','840':'USD','доллар':'USD','eur':'EUR','978':'EUR',
 'евро':'EUR','rub':'RUB','643':'RUB','рубль':'RUB','cny':'CNY','156':'CNY'}.get(s)
def curr(*objects):
 found=set();unknown=False
 for o in objects:
  for k in ('currency','currency_name','currency_code'):
   c=currency(o.get(k))
   if c:found.add(c)
   elif text(o.get(k)):unknown=True
 # User-approved policy: absent currency defaults to UZS; explicit conflicts withheld.
 return None if unknown else (next(iter(found)) if len(found)==1 else ('UZS' if not found else None))
def auction_currency(deal,item):
 # Observed payload forms: completed product at root, or completed_product.
 # Ignore lot_detail: its price is the initial offer, not the completed trade.
 completed=item.get('completed_product')
 return curr(deal,item,completed if isinstance(completed,dict) else {})
def same(a,b):return a is not None and b is not None and abs(a-b)<=max(Decimal('0.01'),abs(a)*Decimal('0.000001'))
def localday(v):
 s=text(v).replace('(Asia/Tashkent)','').strip()
 try:
  d=datetime.fromisoformat(s.replace('Z','+00:00'))
  return (d.astimezone(TZ) if d.tzinfo else d).date()
 except ValueError:
  for f in ('%d.%m.%Y %H:%M','%d.%m.%Y'):
   try:return datetime.strptime(s,f).date()
   except ValueError:pass
 return None
def service(n):return bool(re.search(r'\b(?:услуг\w*|хизмат\w*|xizmat\w*|services?|работа|работы)\b',n.casefold()))
def ro(p):
 c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True,timeout=30)
 c.row_factory=sqlite3.Row;c.execute('PRAGMA query_only=ON');return c

def read_market(c,m,day,stats):
 start=day.isoformat();end=(day+timedelta(days=1)).isoformat()
 if m in ('shop','national'):
  records=[dict(r) for r in c.execute('SELECT * FROM completed_deals WHERE deal_date>=? AND deal_date<?',(start,end))]
  counts=Counter(text(r['deal_id']) for r in records)
  for r in records:
   # Canonical completed-deal amount divided by completed-deal quantity.
   value=num(r.get('deal_cost'));cc=curr(r,raw(r.get('raw_json')))
   if value is None or value<0 or cc is None:value=None;cc=None
   yield (r.get('product_name'),r.get('amount'),r.get('unit_name') or r.get('unit_name_enriched'),
          text(r.get('deal_id')),value,cc,None)
  stats['multirow_deals']=sum(n>1 for n in counts.values())
  latest=c.execute('SELECT max(deal_date),max(last_seen_at) FROM completed_deals').fetchone()
 elif m=='auction':
  deals=[dict(r) for r in c.execute('SELECT * FROM completed_deals WHERE deal_date>=? AND deal_date<?',(start,end))]
  for d in deals:
   items=[dict(r) for r in c.execute('SELECT * FROM auction_products WHERE completed_deal_id=?',(d['id'],))]
   totals=[num(i.get('total_amount')) for i in items]
   currencies=[auction_currency(raw(d.get('raw_json')),raw(i.get('raw_json'))) for i in items]
   currency_consistent=bool(currencies) and all(currencies) and len(set(currencies))==1
   allocation=currency_consistent and bool(items) and all(v is not None for v in totals) and same(sum(totals),num(d.get('contract_price')))
   if not items:stats['deals_without_items']+=1
   for i in items:
    q=num(i.get('quantity'));u=num(i.get('contract_price'));v=num(i.get('total_amount'))
    cc=auction_currency(raw(d.get('raw_json')),raw(i.get('raw_json')))
    verified=allocation and q is not None and u is not None and q>0 and u>=0 and same(q*u,v) and cc is not None
    yield (i.get('product_name'),q,i.get('unit_name'),str(d['deal_id']),v if verified else None,cc if verified else None,i.get('product_code'))
  latest=c.execute('SELECT max(deal_date),max(last_seen_at) FROM completed_deals').fetchone()
 elif m=='xt_auction':
  lo=(day-timedelta(days=1)).isoformat();hi=(day+timedelta(days=2)).isoformat()
  contracts=[dict(r) for r in c.execute('SELECT * FROM contracts WHERE contract_close_at>=? AND contract_close_at<?',(lo,hi)) if localday(r['contract_close_at'])==day]
  procs=defaultdict(list)
  for d in contracts:procs[d['proc_id']].append(d)
  for proc,ds in procs.items():
   items=[dict(r) for r in c.execute('SELECT * FROM auction_items WHERE proc_id=?',(proc,))]
   count=c.execute('SELECT count(*) FROM contracts WHERE proc_id=?',(proc,)).fetchone()[0]
   if count!=1:
    # Quantity cannot be allocated to a contract/day safely for multiple contracts.
    stats['procedures_with_ambiguous_contracts']+=1;continue
   if not items:stats['contracts_without_items']+=1
   d=ds[0];cc=curr(d,raw(d.get('raw_json')))
   parts=[]
   for i in items:
    q=num(i.get('quantity'));u=num(i.get('last_price'))
    parts.append(q*u if q is not None and u is not None else None)
   verified=bool(parts) and all(v is not None and v>=0 for v in parts) and same(sum(parts),num(d.get('contract_totalcost'))) and cc is not None
   for i,v in zip(items,parts):
    yield (i.get('product_name'),i.get('quantity'),i.get('unit_name'),str(d['contract_id']),v if verified else None,cc if verified else None,i.get('product_code'))
  latest=c.execute('SELECT max(contract_close_at),max(updated_at) FROM contracts').fetchone()
 else:
  for rr in c.execute('SELECT * FROM completed_lots WHERE close_date>=? AND close_date<?',(start,end)):
   r=dict(rr);q=num(r.get('quantity'));u=num(r.get('unit_price'));v=num(r.get('total_amount'));cc=curr(r,raw(r.get('raw_json')))
   verified=q is not None and q>0 and u is not None and u>=0 and same(q*u,v) and cc is not None
   yield (r.get('product_name'),q,r.get('unit_name'),str(r.get('contract_id') or r['proc_id']),v if verified else None,cc if verified else None,r.get('product_code'))
  latest=c.execute('SELECT max(close_date),max(updated_at) FROM completed_lots').fetchone()
 stats['latest_event']=latest[0];stats['last_observed_update']=latest[1]
 stats['freshness']='UNVERIFIED'
 if localday(latest[0]) and localday(latest[0])<day and localday(latest[1]) and localday(latest[1])<day:
  stats['freshness']='STALE'

def build(root,day):
 groups={};sources={}
 for m in TITLES:
  stats=Counter();sources[m]={'title':TITLES[m]};p=root/FILES[m]
  if not p.is_file():sources[m]['error']='FILE NOT FOUND';continue
  try:
   with ro(p) as c:
    for name,q,unit,deal,value,cc,code in read_market(c,m,day,stats):
     stats['item_rows']+=1;name=text(name);unit=text(unit).casefold();q=num(q)
     if not name or not deal or q is None or q<=0 or not unit:
      stats['invalid_items']+=1;continue
     if service(name):stats['service_rows_excluded']+=1;continue
     unit=UNITMAP.get(unit,unit)
     # Exact normalized name only. Names with conflicting known codes are withheld below.
     key=(m,unit,name.casefold())
     g=groups.setdefault(key,{'name':name,'unit':unit,'quantity':Decimal(0),'codes':set(),'markets':{}})
     normalized=re.sub(r'\D','',text(code))
     if len(normalized)==14:g['codes'].add(normalized)
     g['quantity']+=q
     mg=g['markets'].setdefault(m,{'quantity':Decimal(0),'priced_quantity':Decimal(0),'deals':set(),'currencies':{}})
     mg['quantity']+=q;mg['deals'].add(deal)
     if value is not None and cc:
      b=mg['currencies'].setdefault(cc,{'amount':Decimal(0),'quantity':Decimal(0)})
      b['amount']+=value;b['quantity']+=q;mg['priced_quantity']+=q
     else:stats['unverified_price_rows']+=1
  except (sqlite3.Error,KeyError) as e:
   sources[m]['error']=str(e)
   groups={k:g for k,g in groups.items() if k[0]!=m}
  sources[m].update(dict(stats))
 bymarket={m:defaultdict(list) for m in TITLES};conflicts=0
 for g in groups.values():
  if len(g['codes'])>1:conflicts+=1;continue
  markets={}
  for m,mg in g['markets'].items():
   full=mg['priced_quantity']==mg['quantity']
   prices=[{'currency':cc,'unit_price':str((b['amount']/b['quantity']).quantize(Decimal('0.01')))} for cc,b in mg['currencies'].items()] if full else []
   markets[m]={'quantity':str(mg['quantity']),'deals_count':len(mg['deals']),
               'prices':prices,'price_status':'CALCULATED_WITH_ACCEPTED_CURRENCY_POLICY' if prices else 'UNVERIFIED'}
  market=next(iter(markets))
  bymarket[market][g['unit']].append({'name':g['name'],'unit':g['unit'],'quantity':str(g['quantity']),'market':market,'prices':markets[market]['prices'],'price_status':markets[market]['price_status']})
 rankings={m:[dict(r,rank=i+1) for i,r in enumerate(sorted([r for rows in units.values() for r in rows],key=lambda r:(-Decimal(r['quantity']),r['name'],r['unit']))[:10])] for m,units in bymarket.items()}
 return {'schema_version':3,'trial':True,'date':day.isoformat(),'generated_at':datetime.now(TZ).isoformat(),
         'currency_policy':'missing currency assumed UZS by user; explicit currency preserved',
         'sources':sources,'top10_by_market':rankings,'conflicting_code_groups_excluded':conflicts,
         'ranking':'numeric quantity across units, per market; units remain visible',
         'identity':'exact name/unit; product/model equivalence unverified',
         'timezone_note':'naive source clocks remain unverified; explicit UTC converted to Tashkent',
         'freshness_note':'row update times do not prove complete day synchronization'}

def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--data-dir',default=r'C:\Qudrat\xarid_uz\UZBI\data')
 a.add_argument('--date',default=(datetime.now(TZ).date()-timedelta(days=1)).isoformat())
 a.add_argument('--output',required=True);args=a.parse_args();day=datetime.strptime(args.date,'%Y-%m-%d').date()
 if day>=datetime.now(TZ).date():a.error('Use a completed day, before today in Tashkent.')
 data=build(Path(args.data_dir),day)
 empty=not any(data['top10_by_market'].values())
 if empty and any(s.get('error') for s in data['sources'].values()):raise SystemExit('STOP: empty results with source read errors; existing ticker preserved.')
 data['display_state']='NO_ELIGIBLE_PRODUCTS' if empty else 'PRODUCTS'
 if empty:print('NO ELIGIBLE PRODUCTS: dated empty result published; not proof of zero trades.')
 out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
 tmp=out.with_name(out.name+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(tmp,out)
 print('BUILD OK | DATE:',data['date'],'| MARKETS:',len(data['top10_by_market']))
 for m,s in data['sources'].items():print(m,'| ITEMS:',s.get('item_rows',0),'| PRICES UNVERIFIED:',s.get('unverified_price_rows',0),'|',s.get('error') or s.get('freshness','UNVERIFIED'))
 print('OUTPUT:',out);print('Source DBs read only. Daily task is configured separately.')
if __name__=='__main__':main()
