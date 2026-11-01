(()=>{'use strict';
const header=document.querySelector('main > header'),app=document.querySelector('#app');if(!header||!app)return;
const bar=document.createElement('div');bar.className='pt-bar';bar.setAttribute('aria-label','Кечаги товар савдолари');
bar.innerHTML='<div class="pt-label">ТОВАРЛАР · СИНОВ<small class="pt-date"></small></div><select class="pt-market" aria-label="Савдо тури"></select><div class="pt-window"><div class="pt-track"></div></div><span class="pt-status"></span><button type="button" aria-label="Тасмани тўхтатиш">Ⅱ</button>';
header.after(bar);const track=bar.querySelector('.pt-track'),marketSelect=bar.querySelector('.pt-market'),pause=bar.querySelector('button');
const labels={dona:'Дона',kg:'Кг',litr:'Литр',metr:'Метр',m2:'м²',m3:'м³',tonna:'Тонна',komplekt:'Комплект',pachka:'Пачка',qadoq:'Қадоқ',juft:'Жуфт',rulon:'Рулон',flakon:'Флакон'};
const titles={shop:'Электрон дўкон',national:'Миллий дўкон',auction:'UZEX аукцион',xt_auction:'XT аукцион',xt_national:'XT миллий дўкон'};
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v));let data,lastSignature='';
const offset=()=>bar.style.setProperty('--pt-top',header.getBoundingClientRect().height+'px');offset();new ResizeObserver(offset).observe(header);
pause.onclick=()=>{const p=bar.classList.toggle('pt-paused');pause.textContent=p?'▶':'Ⅱ';pause.setAttribute('aria-label',p?'Тасмани давом эттириш':'Тасмани тўхтатиш');};
for(const [key,title] of [['all','Барчаси'],...Object.entries(titles)]){const o=document.createElement('option');o.value=key;o.textContent=title;marketSelect.append(o);}
function render(){track.replaceChildren();const lists=(marketSelect.value==='all'?Object.values(data.top10_by_market):[data.top10_by_market[marketSelect.value]||[]]);const rows=[];for(let i=0;i<10;i++)for(const list of lists)if(list[i])rows.push(list[i]);if(!rows.length){track.style.animation='none';const source=data.sources[marketSelect.value];track.textContent=source?.error?'Бу бозор маълумоти олинмади':source?.freshness==='STALE'?'Бу бозор маълумоти янгиланмаган':'Бу кун учун тасмага мос товар маълумоти топилмади';return;}
track.style.animation='';
for(const row of rows){const item=document.createElement('span');item.className='pt-item';const name=document.createElement('b');name.textContent=(titles[row.market]||row.market)+' · №'+row.rank+' · '+row.name;item.append(name);
const qty=document.createElement('em');qty.textContent='Сотилди: '+fmt(row.quantity)+' '+(labels[row.unit]||row.unit);item.append(qty);
for(const price of row.prices||[]){const el=document.createElement('strong');el.textContent='Ўртача: '+fmt(price.unit_price)+' '+(price.currency==='UZS'?'сўм':price.currency)+' / '+(labels[row.unit]||row.unit);item.append(el);}
if(!row.prices?.length){const note=document.createElement('em');note.textContent='Нарх маълумоти етарли эмас';item.append(note);}
track.append(item);}
const originals=[...track.children];for(const el of originals){const copy=el.cloneNode(true);copy.setAttribute('aria-hidden','true');track.append(copy);}track.style.setProperty('--pt-duration',Math.max(20,track.scrollWidth/2/72)+'s');}
marketSelect.onchange=render;
async function refresh(){try{const r=await fetch('/static/product-ticker-data.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.schema_version!==3)throw Error('Schema');const signature=d.date+'|'+d.generated_at;if(signature===lastSignature)return;lastSignature=signature;data=d;
bar.querySelector('.pt-date').textContent=d.date+' · сўм қоидаси';
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const yesterday=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)-1)).toISOString().slice(0,10);const old=d.date<yesterday;
const missing=Object.values(d.sources||{}).filter(s=>s.error||s.freshness==='STALE').length;bar.querySelector('.pt-status').textContent=old?'Сана эски':missing?missing+' манба кечиккан':d.display_state==='NO_ELIGIBLE_PRODUCTS'?'Товар маълумоти етарли эмас':'Қамров текширилмоқда';bar.title='Валюта берилмаган савдо сўм деб қабул қилинган. Синов маълумоти. Ўртача бирлик нархи; моделлар бир хиллиги тасдиқланмаган. '+Object.entries(d.sources||{}).map(([m,s])=>(titles[m]||m)+': '+(s.error||s.last_observed_update||'янгиланиш тасдиқланмаган')).join(' | ');render();
}catch(e){if(!data){track.textContent='Товарлар маълумоти ҳали тайёрланмаган';}bar.querySelector('.pt-status').textContent='Маълумот кутилмоқда';}}
refresh();setInterval(refresh,300000);
})();
