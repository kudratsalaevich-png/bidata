/* Dedicated completed eTender UI. Existing eight platform views are retained. */
async function etenderOpenPlatform(p){
 const host=app; const endpoint='/api/etender-v2/view';
 let tab='overview', page=0, serial=0, applied={}, detailFilter=null;
 const names={overview:'Умумий',records:'Битимлар',products:'Харид предметлари',customers:'Буюртмачилар',providers:'Етказиб берувчилар',regions:'Ҳудудлар',statuses:'Статуслар'};
 const cash=v=>v==null?'Маълумот йўқ':money(v);
 const exact=v=>v==null?'Маълумот йўқ':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v));
 const dateText=v=>{if(!v)return '—';const x=String(v),m=x.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/);return m?`${m[3]}.${m[2]}.${m[1]}${m[4]?' '+m[4]:''}`:x};
 const detailText=(k,v)=>v==null||v===''?'Маълумот йўқ':['start_cost','amount','saving_amount'].includes(k)?exact(v):k==='saving_percent'?exact(v)+' %':['date','contract_date'].includes(k)?dateText(v):String(v);
 let detailName='';
 const style=`<style>
 #etenderView .et-scroll{overflow:auto;max-height:65vh}#etenderView table{width:100%;min-width:850px;border-collapse:collapse}
 #etenderView th,#etenderView td{padding:13px;border-bottom:1px solid var(--line,#e1e8ef);text-align:left}
 #etenderView td{max-width:360px;white-space:normal}#etenderView th{position:sticky;top:0;background:var(--panel,#fff);z-index:1}
 #etenderView .et-filter{display:flex;flex-wrap:wrap;gap:12px;align-items:end}#etenderView label{display:block;margin-bottom:5px}
 #etenderView input,#etenderView select{padding:10px;border:1px solid var(--line,#e1e8ef);border-radius:8px;background:var(--panel,#fff);color:inherit;max-width:100%}
 #etenderView .et-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
 #etenderView .et-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
 #etenderView .et-kpis strong{display:block;font-size:24px;margin-top:8px}#etenderView button.et-link{border:0;background:none;color:#008b74;cursor:pointer;text-align:left;font:inherit;text-decoration:underline}
 #etenderView .et-modal{position:fixed;inset:0;background:#0007;z-index:1000;display:grid;place-items:center;padding:20px}
 #etenderView .et-dialog{background:var(--panel,#fff);color:var(--text,#152442);border-radius:15px;padding:22px;max-height:90vh;overflow:auto;width:min(850px,95vw)}
 #etenderView .et-dialog table{min-width:0}#etenderView .et-dialog th{position:static;width:35%}
 </style>`;
 host.innerHTML=style+'<div id="etenderView"><div class="loading">eTender юкланмоқда…</div></div>';
 const root=host.querySelector('#etenderView');
 let m;
 try{m=await get(endpoint+'/meta')}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;return}
 if(current!=='etender')return;
 const max=m.max_date||new Date().toISOString().slice(0,10);
 root.innerHTML=`<div class="notice">eTender • Битимлар маълумоти: ${esc(m.min_date)} — ${esc(max)} • Базада ${num(m.rows)} битим<br><small>Ҳисоблар танланган давр, валюта ва статус бўйича. Суммалар валюта конвертациясисиз кўрсатилади.</small></div>
 <div class="inner-tabs">${Object.entries(names).map(([k,v])=>`<button data-et-tab="${k}" class="${k===tab?'active':''}">${v}</button>`).join('')}</div>
 <div class="panel et-filter">
 <div><label>Битим санаси: дан</label><input id="etFrom" type="date" value="${max.slice(0,4)}-01-01"></div>
 <div><label>Гача</label><input id="etTo" type="date" value="${esc(max)}"></div>
 <div><label>Валюта</label><select id="etCurrency">${m.currencies.map(v=>`<option ${v==='Сум'?'selected':''} value="${esc(v)}">${esc(v==='Сум'?'Сўм':v)}</option>`).join('')}</select></div>
 <div><label>Битим статуси</label><select id="etStatus"><option value="">Барчаси</option>${m.statuses.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div>
 <div style="flex:1;min-width:220px"><label>Қидириш</label><input id="etQ" style="width:100%" placeholder="Харид предмети, ташкилот, СТИР ёки савдо рақами"></div>
 <button class="btn primary" id="etApply">Қўллаш</button><button class="btn ghost" id="etClear">Тозалаш</button></div>
 <div id="etContext" class="et-actions"></div><div id="etBody"></div><div id="etModal"></div>`;
 const el=id=>root.querySelector('#'+id);
 function readFilters(){return {date_from:el('etFrom').value,date_to:el('etTo').value,currency:el('etCurrency').value,status:el('etStatus').value,q:el('etQ').value.trim()}}
 function query(extra={}){return new URLSearchParams({...applied,...(detailFilter||{}),...extra}).toString()}
 function table(head,rows){return `<div class="panel et-scroll"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${head.length}">Фильтрга мос натижа йўқ</td></tr>`}</tbody></table></div>`}
 function context(){el('etContext').innerHTML=`<span>${esc(dateText(applied.date_from))} — ${esc(dateText(applied.date_to))} • ${esc(applied.currency)} • ${esc(applied.status||'Барча статуслар')} ${applied.q?'• Қидирув: '+esc(applied.q):''}</span>${detailFilter?'<span>'+esc(detailName)+'</span>':''}${detailFilter?'<button class="btn ghost" id="etBack">Кесимдан чиқиш</button>':''}`;if(el('etBack'))el('etBack').onclick=()=>{detailFilter=null;page=0;load()}}
 async function exportFile(format){
  try{const res=await fetch(endpoint+'/export?'+query({format}),{credentials:'same-origin'});if(!res.ok){let d=await res.json();throw Error(d.detail||res.status)}
   const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');a.href=url;a.download='etender_filtered.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert(e.message)}
 }
 function setTab(k){tab=k;page=0;root.querySelectorAll('[data-et-tab]').forEach(b=>b.classList.toggle('active',b.dataset.etTab===k))}
 async function showDeal(id){
  const modal=el('etModal');modal.innerHTML='<div class="et-modal"><div class="et-dialog"><button class="btn ghost" id="etClose">Ёпиш</button><div id="etDetail">Юкланмоқда…</div></div></div>';
  const close=()=>{modal.innerHTML='';document.removeEventListener('keydown',onKey)};const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  el('etClose').onclick=close;modal.querySelector('.et-modal').onclick=e=>{if(e.target.classList.contains('et-modal'))close()};el('etClose').focus();
  try{const d=await get(endpoint+'/deal/'+encodeURIComponent(id));if(!el('etDetail'))return;
   el('etDetail').innerHTML=`<h3>Битим № ${esc(d.row.deal_id)}</h3><small>Пул майдонларининг валютаси: ${esc(d.row.currency)}. Статус тўлов амалга оширилганини автоматик тасдиқламайди.</small><table>${Object.entries(d.labels).map(([k,v])=>`<tr><th>${esc(v)}</th><td>${esc(detailText(k,d.row[k]))}</td></tr>`).join('')}</table>`;
  }catch(e){if(el('etDetail'))el('etDetail').textContent=e.message}
 }
 async function load(){
  const ticket=++serial;context();el('etBody').innerHTML='<div class="loading">Ҳисобланмоқда…</div>';
  try{const d=await get(endpoint+'/data?'+query({tab,offset:page*50}));if(ticket!==serial||current!=='etender')return;
   const body=el('etBody');
   if(tab==='overview'){
    const cards=[['Битимлар суммаси ('+applied.currency+')',cash(d.amount)],['Битимлар сони',num(d.deals)],['Ноёб савдолар сони',num(d.trades)],['Буюртмачилар',num(d.customers)],['Етказиб берувчилар',num(d.providers)],['Ўртача битим суммаси',cash(d.avg_amount)]];
    body.innerHTML=`<div class="et-kpis">${cards.map(([k,v])=>`<div class="card kpi"><div><small>${esc(k)}</small><strong>${esc(v)}</strong></div></div>`).join('')}</div>
     <div class="notice">Жами сумма танланган статуслардаги битимлар суммасидир; «Барчаси» режими рад ва бекор қилинган битимларни ҳам қамрайди. Бу тўланган маблағ ёки компания даромади эмас.</div>
     <h3>Ойлик динамика</h3><small>Охирги ой танланган санагача бўлган қисмни қамрайди.</small>
     ${table(['Ой','Битимлар сони','Битимлар суммаси ('+applied.currency+')'],d.monthly.map(r=>`<tr><td>${esc(r.period)}</td><td>${num(r.deals)}</td><td>${cash(r.amount)}</td></tr>`).join(''))}
     <h3>Статуслар бўйича тақсимот</h3>${table(['Статус','Битимлар','Сумма ('+applied.currency+')'],d.statuses.map((r,i)=>`<tr><td><button class="et-link" data-status-index="${i}">${esc(r.name||'Маълумот йўқ')}</button></td><td>${num(r.deals)}</td><td>${cash(r.amount)}</td></tr>`).join(''))}`;
    body.querySelectorAll('[data-status-index]').forEach(b=>b.onclick=()=>{const r=d.statuses[+b.dataset.statusIndex];detailName='Статус: '+(r.name||'Маълумот йўқ');detailFilter={entity_kind:'statuses',entity_value:r.name};setTab('records');load()});
   }else if(tab==='regions')body.innerHTML=`<div class="notice">${esc(d.reason)}</div>`;
   else if(tab==='records'){
    const fields=['deal_id','date','display_no','product','start_cost','amount','currency','saving_amount','participants','customer','customer_tin','supplier','provider_tin','status'];
    body.innerHTML=`<h3>Битимлар ${detailFilter?'— танланган кесим':''}</h3><div class="et-actions"><span>Жами ${num(d.total)} та; ${d.total?num(page*50+1):0}–${num(page*50+d.rows.length)}</span><button id="etPrev" class="btn ghost" ${page===0?'disabled':''}>←</button><button id="etNext" class="btn ghost" ${(page+1)*50>=d.total?'disabled':''}>→</button><button id="etCsv" class="btn primary">CSV</button><button id="etXlsx" class="btn ghost">Excel</button></div>`+
     table(fields.map(k=>d.labels[k]),d.rows.map(r=>`<tr>${fields.map(k=>`<td>${k==='deal_id'?`<button class="et-link" data-deal="${r.deal_id}">${r.deal_id}</button>`:['start_cost','amount','saving_amount'].includes(k)?cash(r[k]):esc(k==='date'?dateText(r[k]):r[k]??'—')}</td>`).join('')}</tr>`).join(''));
    el('etPrev').onclick=()=>{page=Math.max(0,page-1);load()};el('etNext').onclick=()=>{page++;load()};el('etCsv').onclick=()=>exportFile('csv');el('etXlsx').onclick=()=>exportFile('xlsx');body.querySelectorAll('[data-deal]').forEach(b=>b.onclick=()=>showDeal(b.dataset.deal));
   }else{
    const org=['customers','providers'].includes(tab),status=tab==='statuses';
    const head=['№',names[tab],...(org?['СТИР']:[]),'Битимлар','Ноёб савдолар','Сумма ('+applied.currency+')','Ўртача битим суммаси',...(status?['Битимлар улуши, %']:[])];
    body.innerHTML=`<h3>${names[tab]}</h3><small>${d.limited?'Сумма бўйича TOP 100. Қидирув бутун база бўйича, фильтрлар доирасида ишлайди.':'Барча статуслар бўйича тақсимот.'}</small>`+
     table(head,d.rows.map((r,i)=>`<tr><td>${i+1}</td><td><button class="et-link" data-entity="${i}">${esc(r.name)}</button></td>${org?`<td>${esc(r.inn||'Маълумот йўқ')}</td>`:''}<td>${num(r.deals)}</td><td>${num(r.trades)}</td><td>${cash(r.amount)}</td><td>${cash(r.avg_amount)}</td>${status?`<td>${exact(r.share)}</td>`:''}</tr>`).join(''));
    body.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{const r=d.rows[+b.dataset.entity];detailName=names[tab]+': '+r.name+(org?' • СТИР: '+(r.inn||'Маълумот йўқ'):'');detailFilter={entity_kind:r.entity_kind,entity_value:r.entity_value};setTab('records');load()});
   }
  }catch(e){if(ticket===serial&&current==='etender')el('etBody').innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
 }
 root.querySelectorAll('[data-et-tab]').forEach(b=>b.onclick=()=>{detailFilter=null;setTab(b.dataset.etTab);load()});
 el('etApply').onclick=()=>{applied=readFilters();detailFilter=null;page=0;load()};
 el('etQ').onkeydown=e=>{if(e.key==='Enter')el('etApply').click()};
 el('etClear').onclick=()=>{el('etFrom').value=max.slice(0,4)+'-01-01';el('etTo').value=max;el('etCurrency').value='Сум';el('etStatus').value='';el('etQ').value='';el('etApply').click()};
 applied=readFilters();await load();
}
