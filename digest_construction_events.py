"""Canonical Shaffof/MC award events, from reviewed process history semantics."""
from collections import defaultdict
from contextlib import closing
from datetime import timedelta
import sqlite3

def construction_markets(root,day,kit):
 text,stamp,dec,currency,org,raw,ro=(kit[k] for k in ('text','stamp','dec','currency','org','raw','ro'))
 def norm(s):
  s=text(s).casefold()
  for ch in ('‘','’','ʼ','ʻ','`','ʹ'):s=s.replace(ch,"'")
  return s
 def public(r):return text(r.get('unique_name') or r.get('lotid'))
 def same_identity(s,m):
  a,b=public(s),public(m)
  if a and b:return a==b
  # Internal ID alone is not enough when the public lot number is unavailable.
  return (text(s.get('id'))==text(m.get('id')) and bool(text(s.get('name'))) and norm(s.get('name'))==norm(m.get('name')) and dec(s.get('start_price'))==dec(m.get('start_price')) and bool(text(s.get('customer_inn'))) and text(s.get('customer_inn'))==text(m.get('customer_inn')))
 def empty(m):
  return {'market':m,'title':kit['MARKETS'][m][0],'date':day.isoformat(),'deals_count':None,'amounts_by_currency':{},'top_deals':{},'top_products':[],'top_categories':[],'top_regions':[],'top_customers':[],'top_suppliers':[],'included':False,'coverage':'UNVERIFIED','status':'NO_VERIFIED_DATA','notes':[]}
 sha,mc=empty('shaffof'),empty('mc');sha_events=[];mc_events=[]
 sha_path=root/'shaffof_tenders.sqlite3';mc_path=root/'mc_tenders.sqlite3'
 shrows={};mcrows={};awards={};same_day_repeats={};ambiguous=set();errors={};updates={};winner_times=defaultdict(set)
 if sha_path.is_file():
  try:
   with closing(ro(sha_path)) as c:
    sha.update(kit['freshness'](c,'tenders',day,'shaffof'))
    for row in c.execute('SELECT tender_id,action,created_at FROM tender_process WHERE action LIKE ?',('Tender%aniqlandi%',)):
     if not norm(row['action']).startswith("tender g'olibi aniqlandi"):continue
     d=stamp(row['created_at'])
     if d:winner_times[text(row['tender_id'])].add(d)
    same_day_repeats={}
    for key,times in winner_times.items():
     local_days={d.date() for d in times}
     if len(local_days)==1:
      # The calendar day is established; the exact award instant is not.
      # Earliest timestamp is a representative, not proof of the final winner time.
      awards[key]=min(times)
      if len(times)>1:same_day_repeats[key]=len(times)
     else:ambiguous.add(key)
    fields='id,unique_name,name,start_price,winner_id,winner_offer,winner_name,winner_inn,customer_name,customer_inn,region,object_type,detail_synced_at'
    shrows={text(r['id']):dict(r) for r in c.execute('SELECT '+fields+' FROM tenders')}
  except sqlite3.Error as e:errors['shaffof']=str(e);shrows={};awards={};ambiguous=set()
 else:errors['shaffof']='FILE NOT FOUND'
 if mc_path.is_file():
  try:
   with closing(ro(mc_path)) as c:
    mc.update(kit['freshness'](c,'tenders',day,'mc'))
    fields='id,unique_name,lotid,name,start_price,winner_id,winner_determined_date,currency,customer_name,customer_inn,region_name,region_name_uz,object_type_name,last_detail_sync_at'
    mcrows={text(r['id']):dict(r) for r in c.execute('SELECT '+fields+' FROM tenders')}
  except sqlite3.Error as e:errors['mc']=str(e);mcrows={}
 else:errors['mc']='FILE NOT FOUND'
 by_public=defaultdict(list)
 for key,r in mcrows.items():
  if public(r):by_public[public(r)].append(key)
 matches={};reverse={};collision=set()
 for key,s in shrows.items():
  possible=by_public.get(public(s),[]) if public(s) else []
  if not possible and key in mcrows:possible=[key]
  matched=[i for i in possible if same_identity(s,mcrows[i])]
  if len(matched)==1:
   other=matched[0]
   if other in reverse:collision.update((key,reverse[other]))
   matches[key]=other;reverse[other]=key
  elif len(matched)>1:collision.add(key)
 # Ambiguous identity/history must not be replaced by a conflicting fallback date.
 blocked_mc={matches[k] for k in ambiguous|collision if k in matches}
 sha['ambiguous_award_tenders']=len(ambiguous);sha['ambiguous_identity_tenders']=len(collision)
 sha['matched_mc_tenders']=len(matches)
 sha['same_day_repeated_award_tenders']=len(same_day_repeats)
 sha['same_day_repeated_awards_on_target_day']=sum(awards[k].date()==day for k in same_day_repeats if k in awards)
 def event(m,r,when,amount,cc,buyer,seller,category,region):
  return {'key':'construction:'+ (public(r) or m+':'+text(r.get('id'))),'market':m,'lot':public(r) or text(r.get('id')),'amount':amount,'currency':cc,'assumed_uzs':False,'buyer':buyer,'seller':seller,'category':category,'region':region,'products':[],'event_time':when.isoformat(),'event_time_precision':'day' if m=='shaffof' and text(r.get('id')) in same_day_repeats else 'timestamp','date_basis':'same_local_day_award_history' if m=='shaffof' and text(r.get('id')) in same_day_repeats else 'single_award_timestamp'}
 chosen_sha=set();overlaps=0;currency_inherited=0
 if shrows:
  with closing(ro(sha_path)) as c:
   for key,when in awards.items():
    r=shrows.get(key)
    if not r or key in collision or when.date()!=day:continue
    amount=dec(r.get('winner_offer'))
    if not r.get('winner_id') or amount is None:continue
    jrow=c.execute('SELECT raw_detail_json FROM tenders WHERE id=?',(r['id'],)).fetchone();j=raw(jrow[0]) if jrow else {}
    cc,_=currency(j)
    other=mcrows.get(matches.get(key))
    # Procedure currency can be inherited; proposal date/price cannot.
    if not cc and other:
     # Unknown explicit currency is not silently overridden by another source.
     explicit=any(text(j.get(f)) for f in ('currency','currency_name','currency_code'))
     if not explicit:cc,_=currency(other);currency_inherited+=bool(cc)
    sha_events.append(event('shaffof',r,when,amount,cc,org(r.get('customer_name'),r.get('customer_inn'),'shaffof'),org(r.get('winner_name'),r.get('winner_inn'),'shaffof'),text(r.get('object_type')),text(r.get('region'))))
    chosen_sha.add(key)
 if mcrows:
  with closing(ro(mc_path)) as c:
   for key,r in mcrows.items():
    when=stamp(r.get('winner_determined_date'))
    if not when or when.date()!=day:continue
    shkey=reverse.get(key)
    # Shaffof's process event is canonical across days, including midnight offsets.
    if key in blocked_mc:continue
    sh=shrows.get(shkey)
    if shkey in awards and sh and sh.get('winner_id') and dec(sh.get('winner_offer')) is not None:
     overlaps+=1;continue
    jrow=c.execute('SELECT raw_json FROM tenders WHERE id=?',(r['id'],)).fetchone();j=raw(jrow[0]) if jrow else {};w=j.get('winner_doc') or {};w=w if isinstance(w,dict) else {}
    amount=dec(w.get('offer'));cc,_=currency(r,j)
    # Shared record keys still deduplicate MC fallback records by public identity.
    mc_events.append(event('mc',r,when,amount,cc,org(r.get('customer_name'),r.get('customer_inn'),'mc'),None,text(r.get('object_type_name')),text(r.get('region_name_uz') or r.get('region_name'))))
 # Same public identity duplicated inside a source is excluded rather than summed.
 def unique(events):
  groups=defaultdict(list)
  for e in events:groups[e['key']].append(e)
  return [v[0] for v in groups.values() if len(v)==1],sum(len(v) for v in groups.values() if len(v)>1)
 sha_events,sha_dups=unique(sha_events);mc_events,mc_dups=unique(mc_events)
 sha['duplicate_identity_rows_excluded']=sha_dups;mc['duplicate_identity_rows_excluded']=mc_dups;mc['matched_awards_excluded']=overlaps;sha['currency_inherited_from_mc']=currency_inherited
 sha['notes']=['Кун ғолиб аниқланган жараён ёзувининг вақти бўйича. Сумма — ғолиб таклифи; тўлов суммаси эмас.','MC билан мос тендерлар умумий ҳисобда бир марта саналади. Валюта йўқ бўлса, фақат мос MC тендеридан олинади; акс ҳолда сумма киритилмайди.','Кун тўлиқ қамраб олингани тасдиқланмаган.']
 mc['notes']=['Shaffof жараён тарихи бор мос тендерлар Shaffof карточкасида саналган. Бу ерда MC санаси бўйича қолган натижалар кўрсатилади.','Кун тўлиқ қамраб олингани тасдиқланмаган.']
 if same_day_repeats:sha['notes'].append('Ғолиб аниқланган вақтлар бир маҳаллий кун ичида такрорланган бўлса, тендер шу кунга бир марта саналади. Аниқ соат ягона деб тасдиқланмайди.')
 if ambiguous:sha['notes'].append('Ғолиб аниқланган вақтлар турли кунларга тегишли бўлган тендерлар ҳозирча ҳисобга киритилмади.')
 for m,d,events in (('shaffof',sha,sha_events),('mc',mc,mc_events)):
  if m in errors:d['status']='ERROR';d['notes'].append('Манба ўқилмади: '+errors[m])
  elif events:d.update(kit['summarize'](events));d['deals_count']=len(events);d['included']=True;d['status']='OBSERVED'
  elif m=='mc' and overlaps:d['status']='DUPLICATE_SOURCE';d['notes'].append(str(overlaps)+' та шу кунги MC ёзуви мос Shaffof натижаси билан такрор; қайта қўшилмади.')
  if d.get('stale'):d['notes'].append('Кун якунидан кейин манба янгилангани тасдиқланмаган.')
 return {'shaffof':(sha,sha_events),'mc':(mc,mc_events)}
