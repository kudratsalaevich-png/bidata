
// MARKET_AMOUNT_FILTER_V1 — individual completed trade bounds, before TOP.
function marketAmountsActive(){return ["amountMin","amountMax"].some(id=>document.getElementById(id)?.value!=="" && document.getElementById(id));}
function validateMarketAmounts(){
 const lo=document.getElementById("amountMin"),hi=document.getElementById("amountMax");if(!lo||!hi)return true;
 lo.setCustomValidity("");hi.setCustomValidity("");
 if(!lo.checkValidity()){lo.reportValidity();return false;}if(!hi.checkValidity()){hi.reportValidity();return false;}
 if(lo.value!==""&&hi.value!==""&&Number(lo.value)>Number(hi.value)){hi.setCustomValidity("Охирги сумма бошланғич суммадан кам бўлмасин.");hi.reportValidity();return false;}
 return true;
}
function appendMarketAmounts(p){
 const lo=document.getElementById("amountMin")?.value||"",hi=document.getElementById("amountMax")?.value||"";
 if(lo!=="")p.set("amount_min",lo);if(hi!=="")p.set("amount_max",hi);
}
function showMarketAmountSegment(){
 const el=document.getElementById("marketAmountSegment");if(!el)return;
 const lo=document.getElementById("amountMin")?.value||"",hi=document.getElementById("amountMax")?.value||"";
 el.classList.toggle("hidden",!marketAmountsActive());
 const f=v=>new Intl.NumberFormat("uz-UZ",{maximumFractionDigits:2}).format(Number(v));
 el.textContent=`Битим суммаси: ${lo!==""?f(lo):"0"} сўмдан ${hi!==""?f(hi)+" сўмгача":"юқори — чегарасиз"}. Сана, регион ва қидирув билан бирга қўлланади. Бирлик нархи эмас. Валютаси кўрсатилмаган битимлар бешта бозор учун қабул қилинган сўм қоидасида.`;
}

﻿const $=s=>document.querySelector(s), app=$("#app"), title=$("#title"), sidebar=$("#sidebar");
let platforms=[], current="home", meta=null, chartMode="amount", monthly=[], currentTab="overview";
let __recentFilterKey="all", __activeFilterKey="all";
const money=n=>{n=Number(n||0);if(n>=1e12)return(n/1e12).toFixed(2)+" трлн";if(n>=1e9)return(n/1e9).toFixed(2)+" млрд";if(n>=1e6)return(n/1e6).toFixed(2)+" млн";return new Intl.NumberFormat("ru-RU").format(n)}
const num=n=>new Intl.NumberFormat("ru-RU").format(Math.round(Number(n||0)));
const _cp1252Back={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
function fixText(v){
 let s=String(v??"");
 if(!/[ÐÑÃÂ]/.test(s))return s;
 for(let pass=0;pass<2;pass++){
   try{
     const bytes=[];
     for(const ch of s){const cp=ch.codePointAt(0);if(cp<=255)bytes.push(cp);else if(_cp1252Back[cp]!=null)bytes.push(_cp1252Back[cp]);else throw new Error("not mojibake");}
     const t=new TextDecoder("utf-8",{fatal:true}).decode(new Uint8Array(bytes));
     if(t===s)break;
     if(/[А-Яа-яЁёЎўҚқҒғҲҳ]/.test(t)||!/[ÐÑÃÂ]/.test(t))s=t;else break;
   }catch(_){break;}
 }
 return s;
}
const esc=s=>fixText(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
async function get(u){
 let lastErr=null;
 for(let attempt=1;attempt<=2;attempt++){
   try{
     let r=await fetch(u,{credentials:"same-origin",cache:"no-store"});
     if(r.status===401){throw new Error("HTTP 401")}
     if(!r.ok){
       let txt=await r.text();
       try{let j=JSON.parse(txt);txt=j.detail||txt}catch(_){}
       throw new Error(`HTTP ${r.status}: ${txt}`);
     }
     return await r.json();
   }catch(e){
     lastErr=e;
     if(attempt<2 && (e instanceof TypeError || String(e.message).includes("Failed to fetch"))){
       await new Promise(r=>setTimeout(r,450));
       continue;
     }
     throw e;
   }
 }
 throw lastErr||new Error("Network error");
}
function navActive(k){
 document.querySelectorAll("nav button[data-key]").forEach(b=>{const active=b.dataset.key===k;b.classList.toggle("active",active);if(active){b.setAttribute('aria-current','page');const group=b.closest('[data-nav-group]');if(group)group.open=true}else b.removeAttribute('aria-current')});
 sidebar.classList.remove('open');const hamb=document.querySelector('#hamb');if(hamb)hamb.setAttribute('aria-expanded','false');
}

const PLATFORM_BRAND={
 auction:{logo:"/static/platform-icons/auction.png",source:"xarid.uzex.uz",trade:"Аукцион савдо"},
 shop:{logo:"/static/platform-icons/shop.png",source:"xarid.uzex.uz",trade:"Электрон дўкон"},
 national:{logo:"/static/platform-icons/national.png",source:"xarid.uzex.uz",trade:"Миллий дўкон"},
 xt_auction:{logo:"/static/platform-icons/xt.png",source:"xt-xarid.uz",trade:"Аукцион савдо"},
 xt_national:{logo:"/static/platform-icons/xt.png",source:"xt-xarid.uz",trade:"Миллий дўкон"},
 etender:{logo:"/static/platform-icons/etender.png",source:"etender.uzex.uz",trade:"Тендер савдолари"},
 xt:{logo:"/static/platform-icons/xt.png",source:"xt-xarid.uz",trade:"Тендер савдолари"},
 shaffof:{logo:"/static/platform-icons/shaffof.png",source:"Shaffof Xarid",trade:"Тендер савдолари"},
 mc:{logo:"/static/platform-icons/mc.png",source:"MC.UZ",trade:"Тендер савдолари"}
};
function brandOf(key,obj=null){return {...(PLATFORM_BRAND[key]||{}),...(obj||{})}}
function cleanPlatformName(r){const b=PLATFORM_BRAND[String(r?.platform_key||"")];return b?((b.source||r.platform_key)+" — "+(b.trade||"")):(r?.platform||"—")}
function brandLogo(key,obj=null,cls="platform-brand-logo"){
 const b=brandOf(key,obj);return b.logo?`<img class="${cls}" src="${esc(b.logo)}" alt="${esc(b.source||key||'platform')}">`:`<span class="${cls} fallback">${esc(obj?.icon||'•')}</span>`;
}
function ensureSourceRibbon(){
 let el=document.getElementById("uzbiSourceRibbon");
 if(!el){el=document.createElement("div");el.id="uzbiSourceRibbon";el.className="uzbi-source-ribbon";document.body.appendChild(el)}
 return el;
}
function setSourceContext(text="9 та савдо йўналиши • 5 та веб-манба"){
 const el=ensureSourceRibbon();
 el.innerHTML=`<b>bidata Business Intelligence Platform</b><span>Маълумот манбаи: ${esc(text)}</span>`;
}
function applyNavPlatformLogos(){
 Object.entries(PLATFORM_BRAND).forEach(([key,b])=>{
   const btn=document.querySelector(`nav button[data-key="${key}"]`); if(!btn)return;
   const slot=btn.querySelector("span"); if(!slot)return;
   slot.innerHTML=`<img src="${b.logo}" alt="">`;slot.classList.add("nav-brand-slot");
 });
}

async function bootstrap(){try{platforms=await get("/api/platforms");let h=await get("/api/system/health");$("#online").textContent=`${h.online}/${h.total} база ONLINE`;applyNavPlatformLogos();setSourceContext();showHome()}catch(e){app.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}}
function showHome(){
 current="home";navActive("home");title.textContent="Бош саҳифа";setSourceContext("9 та савдо йўналиши • 5 та веб-манба");
 const online=platforms.filter(x=>x.exists).length,totalRows=platforms.reduce((s,x)=>s+(x.rows||0),0);
 const actions=[['product_analytics','Товар аналитикаси','Нархлар, савдолар ва иштирокчилар'],['market_analytics','Бозор аналитикаси','Ҳажм ва ҳудудлар кесими'],['tender_analytics','Тендер аналитикаси','Тендерлар ва ғолиблар'],['active','Фаол лотлар','Жорий харидлар ва муддатлар'],['daily_digest','Кунлик дайжест','Кунлик натижалар']];
 const cards=keys=>keys.map(k=>platforms.find(p=>p.key===k)).filter(Boolean).map(p=>`<button class="bn-platform" data-home-platform="${esc(p.key)}"><span class="bn-platform-top">${brandLogo(p.key,p)}<small class="${p.exists?'bn-ready':'bn-unavailable'}">${p.exists?'База мавжуд':'База мавжуд эмас'}</small></span><strong>${esc(p.trade_type||p.title)}</strong><span>${esc(p.source||p.title)}</span><small>${p.rows!=null?num(p.rows)+' та ёзув':'Ёзувлар сони мавжуд эмас'}</small><span class="bn-platform-link">Бўлимни очиш →</span></button>`).join('');
 app.innerHTML=`<div class="bn-home"><section class="bn-intro"><div class="bn-intro-head"><div><small>ДАВЛАТ ХАРИДЛАРИ ТАҲЛИЛИ</small><h2>Харидлар бозорини таҳлил қилинг</h2><p>5 та товар ва хизматлар ҳамда 4 та тендер савдо йўналиши.</p></div><span class="bn-mode">Маълумотларни кўриш ва таҳлил қилиш</span></div><label for="globalSearch" class="bn-search-label">Товар қидируви</label><div class="hero-search"><span class="search-ico" aria-hidden="true">⌕</span><input id="globalSearch" placeholder="Товар номи ёки коди…"><button id="globalSearchBtn">Таҳлил қилиш</button></div><div class="examples"><span>Масалан:</span>${['Ноутбук','Цемент','Тиббий жиҳозлар','Қурилиш'].map(q=>`<button data-q="${q}">${q}</button>`).join('')}</div></section>
 <section class="bn-quick" aria-label="Тезкор бўлимлар">${actions.map(([k,title,caption])=>`<button data-home-action="${k}"><strong>${title} →</strong><small>${caption}</small></button>`).join('')}</section>
 <section class="bn-status" aria-label="Маълумот қамрови"><div><strong>${num(totalRows)}</strong><small>Базалардаги жами ёзувлар</small></div><div><strong>${num(platforms.length)}</strong><small>Савдо йўналишлари</small></div><div><strong>${num(online)} / ${num(platforms.length)}</strong><small>Мавжуд базалар</small></div><div><strong>5</strong><small>Веб-манбалар</small></div><p>Жами ёзувлар битим ва тендерларни қамрайди; ягона битимлар сони эмас. База мавжудлиги маълумот янгилигини англатмайди. <button id="bnDiagnostics">Базалар ҳолатини кўриш →</button></p></section>
 <section class="bn-markets"><h3>Товар ва хизматлар <small>5 та йўналиш</small></h3><div class="bn-platform-grid">${cards(['auction','shop','national','xt_auction','xt_national'])}</div></section>
 <section class="bn-markets"><h3>Тендер савдолари <small>4 та йўналиш</small></h3><div class="bn-platform-grid">${cards(['etender','xt','shaffof','mc'])}</div></section>
 <details class="bn-help"><summary>Қандай фойдаланилади?</summary><p>Товар номини ёки кодини қидиринг. Умумий бозор таҳлили, тендерлар ва фаол лотлар учун тегишли тезкор бўлимни танланг. Муайян савдо йўналишини очиб, сана ва бошқа фильтрларни қўлланг.</p></details></div>`;
 const doSearch=()=>{const q=($("#globalSearch")?.value||"").trim();showProductAnalytics(q)};
 $("#globalSearchBtn").onclick=doSearch;$("#globalSearch").onkeydown=e=>{if(e.key==="Enter")doSearch()};
 app.querySelectorAll('.examples button').forEach(b=>b.onclick=()=>showProductAnalytics(b.dataset.q));
 app.querySelectorAll('[data-home-platform]').forEach(b=>b.onclick=()=>openPlatform(b.dataset.homePlatform));
 const handlers={product_analytics:showProductAnalytics,market_analytics:showMarketAnalytics,tender_analytics:showTenderAnalytics,active:showActiveLots,daily_digest:showDailyDigest};
 app.querySelectorAll('[data-home-action]').forEach(b=>b.onclick=()=>handlers[b.dataset.homeAction]());$("#bnDiagnostics").onclick=()=>showDiagnostics();
}
function params(){let p=new URLSearchParams();if($("#from")?.value)p.set("date_from",$("#from").value);if($("#to")?.value)p.set("date_to",$("#to").value);if($("#region")?.value)p.set("region",$("#region").value);if($("#q")?.value.trim())p.set("q",$("#q").value.trim());appendMarketAmounts(p);return p.toString()}
async function openPlatform(k){
 current=k;navActive(k);
 let p=platforms.find(x=>x.key===k);
 title.textContent=p?.title||k;
 if(k==='mc'){
  try{
   if(!window.mcTenderOpenPlatform){
    window.__mcTenderLoader=window.__mcTenderLoader||new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/static/mc_tender_ui.js?v=marketamount5';s.onload=resolve;s.onerror=()=>{window.__mcTenderLoader=null;s.remove();reject(new Error('MC UI load failed'))};document.head.appendChild(s)});
    await window.__mcTenderLoader;
   }
   if(current==='mc')await mcTenderOpenPlatform();
  }catch(e){if(current==='mc')app.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
  return;
 }
 if(k==='shaffof'){
  setSourceContext('Shaffof Xarid');sidebar.classList.remove('open');
  try{
   if(!window.shaffofTenderOpenPlatform){
    window.__shaffofTenderLoader=window.__shaffofTenderLoader||new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/static/shaffof_tender_ui.js?v=marketamount5';s.onload=resolve;s.onerror=()=>{window.__shaffofTenderLoader=null;s.remove();reject(new Error('Shaffof UI load failed'))};document.head.appendChild(s)});
    await window.__shaffofTenderLoader;
   }
   if(current==='shaffof')await shaffofTenderOpenPlatform();
  }catch(e){if(current==='shaffof')app.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
  return;
 }
 if(k==='xt'){
  setSourceContext('xt-xarid.uz');sidebar.classList.remove('open');
  try{
   if(!window.xtTenderOpenPlatform){
    window.__xtTenderLoader=window.__xtTenderLoader||new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/static/xt_tender_ui.js?v=marketamount5';s.onload=resolve;s.onerror=()=>{window.__xtTenderLoader=null;s.remove();reject(new Error('XT UI load failed'))};document.head.appendChild(s)});
    await window.__xtTenderLoader;
   }
   if(current==='xt')await xtTenderOpenPlatform();
  }catch(e){app.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
  return;
 }

 if(k==="etender"){
   sidebar.classList.remove("open");
   setSourceContext("etender.uzex.uz • Тендер битимлари");
   app.innerHTML='<div class="loading">eTender юкланмоқда…</div>';
   try{
     if(typeof etenderOpenPlatform!=="function"){
       if(!window.__etenderUiLoading)window.__etenderUiLoading=new Promise((resolve,reject)=>{
         const script=document.createElement("script");
         script.src="/static/etender_ui.js?v=marketamount5";
         script.onload=resolve;script.onerror=()=>{window.__etenderUiLoading=null;script.remove();reject(new Error("eTender интерфейси юкланмади"))};
         document.head.appendChild(script);
       });
       await window.__etenderUiLoading;
     }
     if(current==="etender")await etenderOpenPlatform(p);
   }catch(e){if(current==="etender")app.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
   return;
 }

 setSourceContext(`${p?.source||p?.title||k} • ${p?.trade_type||""}`);
 sidebar.classList.remove("open");

 // Open page immediately. Do not block UI on metadata scans.
 const today=new Date().toISOString().slice(0,10);
 const year=today.slice(0,4);
 meta={mode:"REAL_READ_ONLY",min_date:`${year}-01-01`,max_date:today,rows:p?.rows||0,regions:[],regions_lazy:true};
 renderShell(p);

 // KPI starts immediately with current-year defaults.
 loadDashboard();

 // Meta refresh happens in background and does not blank the page.
 try{
   const m=await get(`/api/${k}/meta`);
   meta=m;
   if($("#from") && !$("#from").dataset.userChanged){
      let y=(m.max_date||today).slice(0,4);
      $("#from").value=y?`${y}-01-01`:m.min_date||`${year}-01-01`;
      $("#to").value=m.max_date||today;
   }
   const notice=document.querySelector(".notice");
   if(notice)notice.textContent=`${p.title} • ${m.mode} • ${num(m.rows)} қатор`;
 }catch(e){console.error("meta",e)}
}
function renderShell(p){let y=(meta.max_date||"").slice(0,4);app.innerHTML=`<div class="notice source-notice">${brandLogo(p.key,p,"source-notice-logo")}<div><b>${esc(p.trade_type||p.title)}</b><small>bidata Business Intelligence Platform • Маълумот манбаи: ${esc(p.source||p.title)} • ${meta.mode} • ${num(meta.rows)} қатор ${meta.table?'• '+meta.table:''}</small></div></div>
<div class="inner-tabs" id="innerTabs">
  <button class="active" data-tab="overview">Умумий</button>
  <button data-tab="records">Савдо натижалари</button>
  <button data-tab="products">Товарлар</button>
  <button data-tab="customers">Буюртмачилар</button>
  <button data-tab="providers">Етказиб берувчилар</button>
  <button data-tab="regions">Регионлар</button>
  <button data-tab="statuses">Статуслар</button>
</div><div class="panel filterbar" id="marketAmountFilters"><div><label>Дан</label><input id="from" type="date" value="${y?y+'-01-01':meta.min_date||''}"></div><div><label>Гача</label><input id="to" type="date" value="${meta.max_date||''}"></div><div><label>Регион</label><select id="region"><option value="">Барча регионлар</option>${(meta.regions||[]).map(x=>`<option>${esc(x)}</option>`).join("")}</select></div><div><label>Қидириш</label><input id="q" placeholder="Товар номи ёки СТИР..."></div><div><label for="amountMin">Битим суммаси, сўм — дан</label><input id="amountMin" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Масалан: 1 000 000"></div><div><label for="amountMax">Битим суммаси, сўм — гача</label><input id="amountMax" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Масалан: 50 000 000"></div><button class="btn primary" id="apply">Қўллаш</button><button class="btn ghost" id="clear">Тозалаш</button></div><div id="marketAmountSegment" class="market-amount-segment hidden" role="status"></div><div id="overviewView"><div class="kpis"><div class="card kpi"><div class="ico">◉</div><div><small>Савдо ҳажми</small><strong id="amount">…</strong></div></div><div class="card kpi"><div class="ico">▦</div><div><small>Савдо / тендер</small><strong id="deals">…</strong></div></div><div class="card kpi"><div class="ico">♟</div><div><small>Буюртмачилар</small><strong id="customers">…</strong></div></div><div class="card kpi"><div class="ico">▰</div><div><small>Етказиб берувчилар</small><strong id="providers">…</strong></div></div></div><div class="grid2"><div class="panel"><div class="panel-head"><div><h3>Динамика</h3><small>ойлик кесим</small></div><div><button class="btn ghost" id="amountTab">Ҳажм</button><button class="btn ghost" id="countTab">Сони</button></div></div><div id="chart" class="chart"></div></div><div class="panel signals"><h3>↗ bidata Market Intelligence</h3><div id="signals"><div class="loading">Ҳисобланмоқда…</div></div></div></div><div class="section-title"><h3>Бозор кесими</h3><small>TOP 5</small></div><div class="tops" id="tops"><div class="loading">TOP юкланмоқда…</div></div><div id="recordsSection"><div class="section-title"><h3>Савдо натижалари</h3><small>real DB</small></div><div class="panel table-panel"><div class="table-tools"><span id="recordInfo">Охирги 50 қатор</span><div><button class="btn ghost" id="prev">←</button><button class="btn ghost" id="next">→</button><button class="btn ghost" id="exportXlsx">Excel</button><button class="btn primary" id="export">CSV</button></div></div><div class="scroll"><table><thead id="thead"></thead><tbody id="tbody"><tr><td>Юкланмоқда…</td></tr></tbody></table></div></div></div></div>
<div id="dimensionView" class="hidden"></div>`;
document.querySelectorAll("#innerTabs button").forEach(b=>b.onclick=()=>{
 currentTab=b.dataset.tab;
 document.querySelectorAll("#innerTabs button").forEach(x=>x.classList.toggle("active",x===b));
 if(currentTab==="overview"){
   $("#overviewView").classList.remove("hidden");
   $("#dimensionView").classList.add("hidden");

   $("#overviewView").querySelectorAll(":scope > *").forEach(el=>{
     el.classList.remove("hidden");
   });

   loadDashboard();
 } else if(currentTab==="records"){
   $("#overviewView").classList.remove("hidden");
   $("#dimensionView").classList.add("hidden");

   $("#overviewView").querySelectorAll(":scope > *").forEach(el=>{
     el.classList.toggle("hidden", el.id!=="recordsSection");
   });

   offset=0;
   loadRecords();
 } else {
   $("#overviewView").classList.add("hidden");
   $("#dimensionView").classList.remove("hidden");
   loadDimension(currentTab);
 }
});
$("#apply").onclick=()=>{
  if(!validateMarketAmounts())return;
  showMarketAmountSegment();
  offset=0;
  if(currentTab==="overview"){
    loadDashboard();
  }else if(currentTab==="records"){
    loadRecords();
  }else{
    loadDimension(currentTab);
  }
};
$("#from").onchange=()=>$("#from").dataset.userChanged="1";
$("#to").onchange=()=>$("#to").dataset.userChanged="1";
let regionsLoaded=false;
$("#region").onfocus=async()=>{
 if(regionsLoaded)return;
 regionsLoaded=true;
 $("#region").innerHTML='<option value="">Регионлар юкланмоқда…</option>';
 try{
   let rr=await get(`/api/${current}/regions`);
   $("#region").innerHTML='<option value="">Барча регионлар</option>'+rr.map(x=>`<option>${esc(x)}</option>`).join("");
 }catch(e){
   $("#region").innerHTML='<option value="">Барча регионлар</option>';
 }
};
$("#clear").onclick=()=>{let y=(meta.max_date||"").slice(0,4);$("#from").value=y?y+"-01-01":meta.min_date||"";$("#to").value=meta.max_date||"";$("#region").value="";$("#q").value="";$("#amountMin").value="";$("#amountMax").value="";$("#apply").click()};$("#q").onkeydown=e=>{if(e.key==="Enter")$("#apply").click()};for(const id of ["amountMin","amountMax"]){$("#"+id).oninput=()=>$("#"+id).setCustomValidity("");$("#"+id).onkeydown=e=>{if(e.key==="Enter")$("#apply").click()}};$("#amountTab").onclick=()=>{chartMode="amount";drawChart()};$("#countTab").onclick=()=>{chartMode="deals";drawChart()};$("#export").onclick=()=>{if(validateMarketAmounts())location.href=`/api/${current}/export.csv?limit=5000&${params()}`};$("#exportXlsx").onclick=()=>{if(validateMarketAmounts())location.href=`/api/${current}/export.xlsx?limit=5000&${params()}`};$("#prev").onclick=()=>{offset=Math.max(0,offset-50);loadRecords()};$("#next").onclick=()=>{offset+=50;loadRecords()}}
let offset=0;
async function loadDashboard(){
 let p=params();
 $("#amount").textContent=$("#deals").textContent=$("#customers").textContent=$("#providers").textContent="…";
 $("#chart").innerHTML='<div class="loading">График ҳисобланмоқда…</div>';
 $("#tops").innerHTML='<div class="loading">TOP маълумотлар ҳисобланмоқда…</div>';

 // Fire independent requests. One slow query no longer blocks the rest.
 get(`/api/${current}/summary?${p}`).then(s=>{
   $("#amount").textContent=money(s.amount)+(marketAmountsActive()?" сўм":"");
   $("#deals").textContent=num(s.deals);
   $("#customers").textContent=num(s.customers);
   $("#providers").textContent=num(s.providers);
   drawSignals(s);
 }).catch(e=>{
   $("#signals").innerHTML=`<div class="notice error">KPI: ${esc(e.message)}</div>`;
 });

 get(`/api/${current}/monthly?${p}`).then(d=>{
   monthly=d;drawChart();
 }).catch(e=>{
   $("#chart").innerHTML='<div class="loading">График мавжуд эмас</div>';
 });

 loadTops();
 offset=0;
 loadRecords();
}
function drawSignals(s){let avg=s.deals?s.amount/s.deals:0;$("#signals").innerHTML=`<div class="signal"><i>↗</i><p>Жами <b>${num(s.deals)}</b> та ёзув, ҳажм <b>${money(s.amount)}</b>.</p></div><div class="signal"><i>▣</i><p>Товар/категориялар: <b>${num(s.products)}</b>.</p></div><div class="signal"><i>♟</i><p>Буюртмачилар: <b>${num(s.customers)}</b>, етказиб берувчилар: <b>${num(s.providers)}</b>.</p></div><div class="signal"><i>₽</i><p>Ўртача битим ҳажми: <b>${money(avg)}</b>.</p></div>`}
function drawChart(){
 let box=$("#chart");

 if(!monthly.length){
   box.innerHTML='<div class="loading">\u041c\u0430\u044a\u043b\u0443\u043c\u043e\u0442 \u0439\u045e\u049b</div>';
   return;
 }

 let vals=monthly.map(x=>Number(x[chartMode]||0));
 let W=900,H=210,pad=28;

 if(monthly.length===1){
   let v=vals[0];
   let label=chartMode==="amount"?money(v):num(v);
   let period=monthly[0].period||"";

   box.innerHTML=`
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${[45,85,125,165].map(y=>`<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="var(--line)"/>`).join("")}

      <rect x="${W/2-70}" y="65" width="140" height="${H-pad-65}"
            rx="10" fill="#0b9275" opacity=".16"/>

      <line x1="${W/2}" y1="65" x2="${W/2}" y2="${H-pad}"
            stroke="#0b9275" stroke-width="5"/>

      <circle cx="${W/2}" cy="65" r="6"
              fill="white" stroke="#0b9275" stroke-width="3"/>

      <text x="${W/2}" y="30" text-anchor="middle"
            fill="currentColor" font-size="18" font-weight="700">${label}</text>

      <text x="${W/2}" y="${H-5}" text-anchor="middle"
            fill="currentColor" font-size="13">${period}</text>
    </svg>`;
   return;
 }

 let max=Math.max(...vals,1);

 let pts=vals.map((v,i)=>[
   pad+i*(W-pad*2)/Math.max(vals.length-1,1),
   H-pad-(v/max)*(H-60)
 ]);

 let d=pts.map((p,i)=>(i?"L":"M")+p[0]+" "+p[1]).join(" ");
 let area=d+` L ${pts.at(-1)[0]} ${H-pad} L ${pts[0][0]} ${H-pad} Z`;

 box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
   <defs>
     <linearGradient id="g">
       <stop stop-color="#0b9275" stop-opacity=".25"/>
       <stop offset="1" stop-color="#0b9275" stop-opacity="0"/>
     </linearGradient>
   </defs>

   ${[45,85,125,165].map(y=>`<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="var(--line)"/>`).join("")}

   <path d="${area}" fill="url(#g)"/>
   <path d="${d}" fill="none" stroke="#0b9275" stroke-width="3"/>

   ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4"
      fill="white" stroke="#0b9275">
      <title>${monthly[i].period}: ${chartMode==="amount"?money(vals[i]):num(vals[i])}</title>
   </circle>`).join("")}
 </svg>`;
}
function topCard(t,d){let max=Math.max(...d.map(x=>Number(x.amount||x.deals)),1);return `<div class="card topcard"><h4>${t}</h4>${d.length?d.map((x,i)=>`<div class="toprow"><span>${i+1}</span><div><div class="nm" title="${esc(x.name)}">${esc(x.name)}</div><div class="bar"><i style="width:${Math.max(4,Number(x.amount||x.deals)/max*100)}%"></i></div></div><span class="v">${money(x.amount)}</span></div>`).join(''):'<small>Маълумот йўқ</small>'}</div>`}
async function loadTops(){let dims=[["products","TOP товарлар"],["categories","TOP категориялар"],["regions","TOP регионлар"],["customers","TOP буюртмачилар"],["providers","TOP етказиб берувчилар"]];let rr=await Promise.allSettled(dims.map(x=>get(`/api/${current}/top/${x[0]}?${params()}`)));$("#tops").innerHTML=rr.map((r,i)=>topCard(dims[i][1],r.status==="fulfilled"?r.value:[])).join("")}
async function loadRecords(){try{let qp=params();let d=await get(`/api/${current}/records?limit=50&offset=${offset}&${qp}`);$("#recordInfo").textContent=`${offset+1}–${offset+d.rows.length}`;$("#thead").innerHTML='<tr>'+d.columns.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>';$("#tbody").innerHTML=d.rows.map(r=>'<tr>'+d.columns.map(c=>`<td title="${esc(r[c])}" class="${c.includes('amount')||c.includes('price')?'money':''}">${(c.includes('amount')||c.includes('price'))&&typeof r[c]==='number'?money(r[c]):esc(r[c])}</td>`).join('')+'</tr>').join('')||'<tr><td>Маълумот йўқ</td></tr>'}catch(e){$("#tbody").innerHTML=`<tr><td>${esc(e.message)}</td></tr>`}}

const dimTitles={products:"Товарлар",customers:"Буюртмачилар",providers:"Етказиб берувчилар",regions:"Регионлар",statuses:"Статуслар",categories:"Категориялар"};
async function loadDimension(dim){
 const box=$("#dimensionView");

 const head = dim==="products" && (current==="shop" || current==="national")
   ? '<th>№</th><th>ТОВАР</th><th>ЎЛЧОВ БИРЛИГИ</th><th title="Танланган фильтрларга мос савдо ёзувлари сони">БИТИМЛАР СОНИ</th><th>ЖАМИ МИҚДОР</th><th title="Жами сумма / жами миқдор">ЎРТАЧА БИРЛИК БАҲОСИ</th><th>ЖАМИ СУММА</th><th>РЕГИОН</th>'
   : dim==="products" && (current==="auction" || current==="xt_auction")
   ? '<th>№</th><th>ТОВАР</th><th>ЎЛЧОВ БИРЛИГИ</th><th>САВДОЛАР СОНИ</th><th>ЖАМИ МИҚДОР</th><th>ЖАМИ СУММА</th>'
   : dim==="products"
   ? '<th>№</th><th>ТОВАР</th><th>ЎЛЧОВ БИРЛИГИ</th><th>САВДОЛАР СОНИ</th><th>ЖАМИ МИҚДОР</th><th>ЎРТАЧА БИРЛИК БАҲОСИ</th><th>ЖАМИ СУММА</th><th>РЕГИОН</th><th>ЎРТАЧА САВДО</th>'
   : dim==="customers" && (current==="shop" || current==="national")
   ? '<th>№</th><th>НОМИ</th><th>СТИР</th><th>ЎЛЧОВ БИРЛИГИ</th><th>МИҚДОР</th><th>ҲАЖМ</th><th>РЕГИОН</th>'
   : dim==="providers" && (current==="shop" || current==="national")
   ? '<th>№</th><th>НОМИ</th><th>СТИР</th><th>ЎЛЧОВ БИРЛИГИ</th><th>МИҚДОР</th><th>ҲАЖМ</th><th>РЕГИОН</th>'
   : dim==="customers" || dim==="providers"
   ? '<th>№</th><th>НОМИ</th><th>СТИР</th><th>САВДОЛАР</th><th>ҲАЖМ</th><th>ЎРТАЧА</th>'
   : '<th>№</th><th>НОМИ</th><th>САВДОЛАР</th><th>ҲАЖМ</th><th>ЎРТАЧА</th>';

 const cols = dim==="products" && (current==="shop" || current==="national") ? 8 : dim==="products" && (current==="auction" || current==="xt_auction") ? 6 : dim==="products" ? 9 : dim==="customers" && (current==="shop" || current==="national") ? 7 : dim==="providers" && (current==="shop" || current==="national") ? 7 : (dim==="customers" || dim==="providers") ? 6 : 5;

 box.innerHTML=`<div class="panel dimension-head"><div><h3>${dimTitles[dim]||dim}</h3><small>TOP 100 • реал база</small>${dim==="products"?'<p style="font-size:13px;color:var(--muted,#65778b);margin:8px 0 0">Савдолар сони ва товар миқдори алоҳида кўрсатилади. Бир битимда бир нечта товар бирлиги бўлиши мумкин. Бир хил номдаги турли моделлар шу ном остида жамланиши мумкин.</p>':''}</div><div><input id="dimQ" placeholder="Номи бўйича қидириш..."><button class="btn primary" id="dimSearch">Қидириш</button></div></div><div class="panel table-panel"><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody id="dimRows"><tr><td colspan="${cols}">Юкланмоқда…</td></tr></tbody></table></div></div>`;

 async function run(){
   try{
    const p=new URLSearchParams();
    p.set("limit","100");
    appendMarketAmounts(p);
    if($("#from")?.value)p.set("date_from",$("#from").value);
    if($("#to")?.value)p.set("date_to",$("#to").value);
    if($("#region")?.value)p.set("region",$("#region").value);
    const localQ=$("#dimQ")?.value.trim()||"";
    const globalQ=$("#q")?.value.trim()||"";

    const globalIsTin=/^\d{8,}$/.test(globalQ);

    if(current==="auction" || current==="xt_auction"){
      const dimSearchQ=localQ||globalQ;
      if(dimSearchQ)p.set("q",dimSearchQ);

    }else if(
      current==="shop" &&
      globalIsTin
    ){
      // SHOP global TIN:
      // filter every dimension by customer/provider TIN.
      // Local dimension search still has priority.
      const dimSearchQ=localQ||globalQ;
      if(dimSearchQ)p.set("q",dimSearchQ);

    }else if(
      dim==="providers" ||
      dim==="customers" ||
      dim==="regions" ||
      dim==="statuses"
    ){
      if(localQ)p.set("q",localQ);
      if(globalQ)p.set("product_q",globalQ);

    }else{
      const dimSearchQ=localQ||globalQ;
      if(dimSearchQ)p.set("q",dimSearchQ);
    }

    const rows=await get(`/api/${current}/dimension/${dim}?${p.toString()}`);

    $("#dimRows").innerHTML=rows.map((r,i)=>{
      if(dim==="products" && (current==="shop" || current==="national")){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.unit_name||"—")}</td>
          <td title="${r.deals==null?'Битимлар сони бу API жавобида берилмаган':''}">${r.deals==null?'—':num(r.deals)}</td>
          <td>${num(r.quantity)}</td>
          <td class="money">${money(r.unit_price)}</td>
          <td class="money">${money(r.amount)}</td>
          <td>${esc(r.region_name||"—")}</td>
        </tr>`;
      }

      if(dim==="products" && (current==="auction" || current==="xt_auction")){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.unit_name||"—")}</td>
          <td>${r.deals==null?'—':num(r.deals)}</td>
          <td>${num(r.quantity)}</td>
          <td class="money">${money(r.amount)}</td>
        </tr>`;
      }

      if(dim==="products"){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.unit_name||"—")}</td>
          <td>${r.deals==null?'—':num(r.deals)}</td>
          <td>${num(r.quantity)}</td>
          <td class="money">${money(r.unit_price)}</td>
          <td class="money">${money(r.amount)}</td>
          <td>${esc(r.region_name||"—")}</td>
          <td class="money">${money(r.avg_amount)}</td>
        </tr>`;
      }

      if(dim==="customers" && (current==="shop" || current==="national")){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.inn||"—")}</td>
          <td>${esc(r.unit_name||"—")}</td>
          <td>${num(r.quantity)}</td>
          <td class="money">${money(r.amount)}</td>
          <td>${esc(r.region_name||"—")}</td>
        </tr>`;
      }

      if(dim==="customers"){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.customer_tin||"—")}</td>
          <td>${num(r.deals)}</td>
          <td class="money">${money(r.amount)}</td>
          <td class="money">${money(r.avg_amount)}</td>
        </tr>`;
      }

      if(dim==="providers" && (current==="shop" || current==="national")){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.inn||"—")}</td>
          <td>${esc(r.unit_name||"—")}</td>
          <td>${num(r.quantity)}</td>
          <td class="money">${money(r.amount)}</td>
          <td>${esc(r.region_name||"—")}</td>
        </tr>`;
      }

      if(dim==="providers"){
        return `<tr>
          <td>${i+1}</td>
          <td title="${esc(r.name)}">${esc(r.name)}</td>
          <td>${esc(r.provider_tin||"—")}</td>
          <td>${num(r.deals)}</td>
          <td class="money">${money(r.amount)}</td>
          <td class="money">${money(r.avg_amount)}</td>
        </tr>`;
      }

      return `<tr>
        <td>${i+1}</td>
        <td title="${esc(r.name)}">${esc(r.name)}</td>
        <td>${num(r.deals)}</td>
        <td class="money">${money(r.amount)}</td>
        <td>${money(r.avg_amount)}</td>
      </tr>`;
    }).join("")||`<tr><td colspan="${cols}">Маълумот йўқ</td></tr>`;

   }catch(e){
     $("#dimRows").innerHTML=`<tr><td colspan="${cols}"><div class="notice error"><b>Аналитика сўровида хато</b><br>${esc(e.message)}${(current==="auction" || current==="xt_auction")?'<br><small>Diagnostic: /api/auction/analytics-check</small>':''}</div></td></tr>`;
   }
 }

 $("#dimSearch").onclick=run;
 $("#dimQ").onkeydown=e=>{if(e.key==="Enter")run()};
 run();
}

async function showProductAnalytics(initialQ=""){
 current="product_analytics";navActive("product_analytics");title.textContent="Товар аналитикаси";
 app.innerHTML=`
 <section class="analytics-hero-mini">
   <span>bidata PRODUCT INTELLIGENCE</span>
   <h2>Товар номи бўйича таҳлил</h2>
   <p>Товарни қидиринг ва платформалар бўйича савдо ҳажми, нархлар ва иштирокчиларни кўринг.</p>
   <div class="hero-search compact-search"><span class="search-ico">⌕</span><input id="paQ" value="${esc(initialQ)}" placeholder="Масалан: ноутбук"><button id="paBtn">Қидириш</button></div>
 </section>
 <section class="panel" style="max-width:1100px;margin:0 auto 18px;padding:16px 18px">
   <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap">
     <div><span style="font-size:11px;font-weight:800;letter-spacing:.08em;color:#087f69">ТОВАР КОДЛАРИ</span><h3 style="margin:4px 0 3px">Товар номи ва кодлар справочниги</h3><small id="pcStats" style="color:#64748b">База маълумоти юкланмоқда…</small></div>
     <div style="display:flex;gap:8px;flex:1;max-width:560px;min-width:280px"><input id="pcQ" style="flex:1" placeholder="Товар номи ёки код: 16101011900002"><button class="btn primary" id="pcBtn">Қидириш</button></div>
   </div>
   <div id="pcResults" style="margin-top:12px"></div>
 </section>
 <div id="paResults" class="analytics-result"><div class="empty-state"><div>⌕</div><h3>Товар номини киритинг</h3><p>bidata мавжуд платформалардан мос маълумотларни топади.</p></div></div>`;
 $("#paBtn").onclick=()=>runProductAnalytics();$("#paQ").onkeydown=e=>{if(e.key==="Enter")runProductAnalytics()};
 $("#pcBtn").onclick=()=>searchProductCodes();$("#pcQ").onkeydown=e=>{if(e.key==="Enter")searchProductCodes()};
 setupFastProductSuggest();loadProductCodeStats();
 if(initialQ)runProductAnalytics();
}


async function loadProductCodeStats(){
 try{
   const d=await get('/api/product-codes/stats');
   const el=$('#pcStats');if(!el)return;
   el.textContent=d.exists?`${num(d.codes||0)} та уникал код • база автоматик янгиланади${d.updated_at?' • '+String(d.updated_at).slice(0,16):''}`:'Товар кодлари базаси топилмади';
 }catch(e){const el=$('#pcStats');if(el)el.textContent='Товар кодлари базасига уланиб бўлмади'}
}

async function searchProductCodes(){
 const q=($('#pcQ')?.value||'').trim(), box=$('#pcResults');if(!box||!q)return;
 box.innerHTML='<div class="loading">Товар кодлари қидирилмоқда…</div>';
 try{
   const d=await get(`/api/product-codes/search?q=${encodeURIComponent(q)}&limit=40`), rows=d.rows||[];
   box.innerHTML=rows.length?`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${rows.map((r,i)=>`<button type="button" class="pc-result" data-pc-index="${i}" style="text-align:left;border:1px solid var(--line,#dbe3ea);background:#fff;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><b style="font-size:14px;color:#071a3d">${esc(r.product_name||'—')}</b><code style="font-size:12px;font-weight:800;color:#087f69;white-space:nowrap">${esc(r.product_code||'—')}</code></div>${r.category_name?`<small style="display:block;color:#64748b;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.category_name)}</small>`:''}</button>`).join('')}</div>`:`<div class="notice">“${esc(q)}” бўйича товар коди топилмади.</div>`;
   box.querySelectorAll('.pc-result').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.pcIndex)];if(!r)return;const input=$('#paQ');if(input)input.value=r.product_name||'';runProductAnalytics()});
 }catch(e){box.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
}

function productCodeBadges(codes){
 const rows=Array.isArray(codes)?codes:[];if(!rows.length)return '';
 return `<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">${rows.slice(0,8).map(r=>`<span title="${esc(r.category_name||'')}" style="display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:8px;background:#eefaf7;border:1px solid #d5eee7;color:#087f69;font-size:12px;font-weight:800">Код: ${esc(r.product_code||'—')}</span>`).join('')}</div>`;
}

let paSuggestTimer=null;
function setupFastProductSuggest(){
 const input=$("#paQ"); if(!input)return;
 let drop=document.createElement("div");drop.id="paSuggest";drop.style.cssText="position:relative;z-index:20;margin:-8px auto 16px;max-width:920px";
 input.closest(".analytics-hero-mini")?.after(drop);
 const search=async()=>{
   const q=(input.value||"").trim();
   if(q.length<2){drop.innerHTML="";return}
   try{
     const rows=await get(`/api/products/search?q=${encodeURIComponent(q)}&limit=12`);
     drop.innerHTML=rows.length?`<div class="panel" style="padding:6px">${rows.map(r=>`<button type="button" class="fast-product-option" data-name="${esc(r.display_name)}" style="width:100%;text-align:left;padding:11px 13px;border:0;border-bottom:1px solid var(--line);background:transparent;cursor:pointer"><b>${esc(r.display_name)}</b><small style="display:block;opacity:.7;margin-top:3px">${num(r.deals_count||0)} та савдо • ${num(r.markets_count||0)} бозор</small></button>`).join("")}</div>`:"";
     drop.querySelectorAll(".fast-product-option").forEach(b=>b.onclick=()=>{input.value=b.dataset.name||"";drop.innerHTML="";runProductAnalytics()});
   }catch(e){console.error("fast product search",e)}
 };
 input.oninput=()=>{clearTimeout(paSuggestTimer);paSuggestTimer=setTimeout(search,120)};
}



// ===== bidata v6: clickable cards + product properties for recent 30-day deals =====
let __uzbiRecentDeals=[];

function ensureRecentDealCardStyles(){
 if(document.getElementById('uzbiRecentDealCardStyles'))return;
 const st=document.createElement('style');
 st.id='uzbiRecentDealCardStyles';
 st.textContent=`
 .recent-deal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px}
 .recent-deal-card{border:1px solid var(--line,#dbe3ea);border-radius:18px;background:#fff;padding:18px 18px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;min-width:0;box-shadow:0 1px 0 rgba(15,23,42,.02)}
 .recent-deal-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(15,23,42,.08);border-color:#b8c9d7}
 .recent-deal-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
 .recent-deal-badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
 .recent-deal-badge{display:inline-flex;align-items:center;gap:7px;border:1px solid #d9e2ea;border-radius:9px;padding:7px 10px;font-size:13px;font-weight:800;line-height:1.1;background:#f8fafc;color:#0f2747}
 .recent-deal-badge.platform{background:#eefaf7;border-color:#d5eee7;color:#087f69}
 .recent-deal-date{font-size:13px;color:#64748b;white-space:nowrap}
 .recent-deal-title{font-size:20px;line-height:1.25;font-weight:850;color:#071a3d;margin:0 0 9px;overflow-wrap:anywhere}
 .recent-deal-desc{font-size:13.5px;line-height:1.52;color:#52627a;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .recent-deal-desc.product-preview{min-height:40px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.recent-deal-desc.product-preview b{color:#10213e}.recent-deal-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
 .recent-deal-tag{background:#f3f6f8;border-radius:8px;padding:6px 9px;font-size:12px;color:#334155;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .recent-deal-foot{border-top:1px solid #e7edf2;padding-top:12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end}
 .recent-deal-party{min-width:0;color:#52627a;font-size:12.5px;line-height:1.5}
 .recent-deal-party div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .recent-deal-price{text-align:right;white-space:nowrap}
 .recent-deal-price strong{display:block;font-size:20px;color:#071a3d}
 .recent-deal-price small{display:block;color:#64748b;margin-top:3px}
 .recent-deal-empty{grid-column:1/-1;padding:28px;text-align:center;color:#64748b;border:1px dashed var(--line,#dbe3ea);border-radius:16px}
 .uzbi-deal-modal{position:fixed;inset:0;background:rgba(2,12,27,.54);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px}
 .uzbi-deal-modal-card{width:min(1080px,97vw);max-height:95vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.28);padding:18px 22px}
 .uzbi-deal-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid #e8edf2;padding-bottom:10px;margin-bottom:10px}
 .uzbi-deal-modal-head span{font-size:11px;font-weight:800;letter-spacing:.12em;color:#07957c}
 .uzbi-deal-modal-head h3{margin:3px 0 0;font-size:22px;line-height:1.2;color:#071a3d}
 .uzbi-deal-modal-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;font-size:20px;cursor:pointer;color:#334155;flex:0 0 auto}
 .uzbi-deal-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:22px;row-gap:0}
 .uzbi-deal-detail{padding:6px 0;border-bottom:1px solid #eef2f6;min-width:0}
 .uzbi-deal-detail.full{grid-column:1/-1}
 .uzbi-deal-detail small{display:block;font-size:9px;letter-spacing:.05em;color:#8a9ab0;text-transform:uppercase;margin-bottom:2px}
 .uzbi-deal-detail b{display:block;font-size:13px;line-height:1.3;color:#10213e;overflow-wrap:anywhere}
 .uzbi-deal-properties{grid-column:1/-1;margin-top:8px;padding:12px 14px;border:1px solid #dfe8ef;border-radius:12px;background:#f8fafc}
 .uzbi-deal-properties h4{margin:0 0 7px;font-size:15px;color:#071a3d}
 .uzbi-deal-properties-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.4;color:#334155}
 .uzbi-deal-prop-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px;row-gap:0}
 .uzbi-deal-prop-item{padding:5px 0;border-bottom:1px solid #e6edf3;min-width:0}
 .uzbi-deal-prop-item small{display:block;color:#8a9ab0;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
 .uzbi-deal-prop-item b{display:block;color:#10213e;font-size:12px;line-height:1.3;overflow-wrap:anywhere}
 .active-lot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}
 .active-lot-card{border:1px solid var(--line,#dbe3ea);border-radius:18px;background:#fff;padding:17px 19px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;min-width:0}
 .active-lot-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(15,23,42,.08);border-color:#a9c5bc}
 .active-lot-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}
 .active-lot-badges{display:flex;gap:7px;flex-wrap:wrap;min-width:0}
 .active-lot-badge{display:inline-flex;align-items:center;border:1px solid #d9e2ea;border-radius:8px;padding:5px 9px;font-size:12px;font-weight:750;line-height:1;background:#f8fafc;color:#0f2747}
 .active-lot-badge.platform{background:#eefaf7;border-color:#d5eee7;color:#087f69}
 .active-lot-deadline{display:inline-flex;align-items:center;border-radius:9px;padding:6px 9px;font-size:11px;font-weight:800;white-space:nowrap;background:#edf7f3;color:#087f69}
 .active-lot-deadline.soon{background:#fff4dd;color:#9a5c00}.active-lot-deadline.today{background:#fff0f0;color:#b42318}.active-lot-deadline.expired{background:#f1f5f9;color:#64748b}
 .active-lot-title{font-size:18px;line-height:1.3;font-weight:800;color:#071a3d;margin:0 0 8px;overflow-wrap:anywhere}
 .active-lot-preview{font-size:13px;line-height:1.5;color:#52627a;min-height:39px;margin-bottom:11px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .active-lot-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.active-lot-tag{background:#f3f6f8;border-radius:7px;padding:5px 8px;font-size:11px;color:#334155;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .active-lot-foot{border-top:1px solid #e7edf2;padding-top:11px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end}.active-lot-meta{min-width:0;color:#52627a;font-size:12px;line-height:1.5}.active-lot-meta div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.active-lot-price{text-align:right;white-space:nowrap}.active-lot-price strong{display:block;font-size:18px;color:#071a3d}.active-lot-price small{display:block;color:#64748b;margin-top:3px}
 .active-lot-empty{grid-column:1/-1;padding:28px;text-align:center;color:#64748b;border:1px dashed var(--line,#dbe3ea);border-radius:16px}
 .active-lot-detail-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.active-lot-source-btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
 .active-products-wrap{grid-column:1/-1;margin-top:4px}.active-products-wrap>h4{margin:4px 0 10px;font-size:16px;color:#071a3d}.active-products-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.active-product-detail-card{border:1px solid #dfe7ee;border-radius:14px;padding:14px 15px;background:#fbfcfd;min-width:0}.active-product-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.active-product-detail-head h5{margin:0;font-size:15px;line-height:1.3;color:#071a3d}.active-product-no{flex:0 0 auto;border-radius:7px;background:#eefaf7;color:#087f69;font-size:11px;font-weight:800;padding:4px 7px}.active-product-desc{font-size:12px;line-height:1.45;color:#52627a;margin:7px 0 9px}.active-product-metrics{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.active-product-metrics span{background:#f1f5f9;border-radius:7px;padding:5px 7px;font-size:11px;color:#334155}.active-product-code{font-size:11px;color:#718096;margin-top:6px;overflow-wrap:anywhere}.active-product-props{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;border-top:1px solid #e6edf2;padding-top:8px;margin-top:8px}.active-product-prop{font-size:11px;line-height:1.35;color:#44546a}.active-product-prop b{color:#10213e}.active-extra-block{grid-column:1/-1;border:1px solid #e4ebf1;border-radius:12px;padding:11px 13px;background:#fafbfd;margin-top:6px}.active-extra-block h4{margin:0 0 6px;font-size:13px}.active-extra-block p{margin:0;font-size:11px;line-height:1.45;color:#52627a;white-space:pre-wrap}
 .xt-sale-summary{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid #dfe8ef;border-radius:14px;overflow:hidden;margin-top:2px}
 .xt-sale-cell{padding:11px 13px;border-right:1px solid #e7edf2;border-bottom:1px solid #e7edf2;min-width:0}
 .xt-sale-cell:nth-child(5){border-right:0}.xt-sale-cell.price,.xt-sale-cell.total{border-bottom:0}.xt-sale-cell.total{grid-column:2/6;border-right:0}
 .xt-sale-cell small{display:block;font-size:10px;color:#7b8ba1;margin-bottom:4px}.xt-sale-cell b{font-size:14px;color:#10213e;overflow-wrap:anywhere}.xt-sale-cell.price b,.xt-sale-cell.total b{font-size:19px;color:#07957c}
 .xt-party-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.xt-party-card{border:1px solid #dfe8ef;border-radius:13px;padding:11px 13px;background:#fff;min-width:0}.xt-party-card small{display:block;color:#7b8ba1;font-size:10px;margin-bottom:4px}.xt-party-card b{display:block;color:#10213e;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
 @media(max-width:1280px){.recent-deal-grid,.active-lot-grid{grid-template-columns:repeat(2,minmax(0,1fr))}} @media(max-width:900px){.recent-deal-grid,.active-lot-grid,.active-products-grid{grid-template-columns:1fr}.uzbi-deal-detail-grid{grid-template-columns:1fr}.uzbi-deal-detail.full{grid-column:auto}.uzbi-deal-prop-list,.active-product-props{grid-template-columns:1fr}.xt-sale-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.xt-sale-cell:nth-child(5){border-right:1px solid #e7edf2}.xt-sale-cell.total{grid-column:auto}.xt-party-grid{grid-template-columns:1fr}}
 @media(max-width:560px){.recent-deal-card,.active-lot-card{padding:15px}.recent-deal-foot,.active-lot-foot{grid-template-columns:1fr}.recent-deal-price,.active-lot-price{text-align:left}.uzbi-deal-modal{padding:10px}.uzbi-deal-modal-card{padding:18px}.uzbi-deal-modal-head h3{font-size:20px}}
 `;
 document.head.appendChild(st);
}

function _parseMaybeJson(v){
 if(v==null||v==='')return null;
 if(typeof v!=='string')return v;
 const t=v.trim();if(!t)return null;
 try{return JSON.parse(t)}catch(_){return v}
}
function _findNamedProperty(raw,wanted){
 const root=_parseMaybeJson(raw), target=String(wanted||'').trim().toLocaleLowerCase('ru-RU');
 let found='';
 const walk=(x)=>{
  if(found||x==null)return;
  if(Array.isArray(x)){for(const it of x){walk(it);if(found)return}return}
  if(typeof x!=='object')return;
  const name=x.property_name??x.name??x.key??x.title??x.label;
  const value=x.property_value??x.value??x.val??x.text??x.description;
  if(name!=null){
   const nn=String(name).trim().toLocaleLowerCase('ru-RU');
   if(nn===target||nn.startsWith(target+':')||nn.startsWith(target+' ')){
    if(value!=null&&String(value).trim())found=String(value).trim();
   }
  }
  if(found)return;
  for(const [k,v] of Object.entries(x)){
   const kk=String(k).trim().toLocaleLowerCase('ru-RU');
   if(kk===target||kk.startsWith(target+':')){
    if(v!=null&&typeof v!=='object'&&String(v).trim()){found=String(v).trim();return}
   }
  }
  for(const v of Object.values(x)){if(v&&typeof v==='object'){walk(v);if(found)return}}
 };
 walk(root);return found;
}
function recentDealPreview(r){
 const key=String(r.platform_key||'').toLocaleLowerCase('ru-RU');
 if(key==='shop'||key==='national'){
  const kind=_findNamedProperty(r.properties_json,'Вид')||_findNamedProperty(r.attributes_json,'Вид');
  return kind?`<b>Вид:</b> ${esc(kind)}`:'';
 }
 if(key==='auction'){
  const d=String(r.description||'').trim();
  return d?`<b>Товар тавсифи:</b> ${esc(d)}`:'';
 }
 return '';
}
function recentDealCard(r,i){
 const qty=r.quantity!=null?`${num(r.quantity)} ${esc(r.unit_name||'')}`.trim():'Миқдор —';
 const lot=esc(r.lot_no||'—');
 const region=esc(r.region||'—');
 const customer=esc(r.customer||'—');
 const supplier=esc(r.supplier||'—');
 const unitPrice=r.unit_price!=null?money(r.unit_price):'—';
 const total=r.total_value!=null?money(r.total_value):'—';
 const preview=recentDealPreview(r);
 return `<article class="recent-deal-card" role="button" tabindex="0" data-recent-deal-index="${i}">
   <div class="recent-deal-top">
     <div class="recent-deal-badges"><span class="recent-deal-badge platform branded-badge">${brandLogo(r.platform_key,null,"badge-platform-logo")}${esc(cleanPlatformName(r))}</span><span class="recent-deal-badge">Лот № ${lot}</span></div>
     <span class="recent-deal-date">${esc(String(r.date||'').slice(0,10)||'—')}</span>
   </div>
   <h4 class="recent-deal-title">${esc(r.product_name||'—')}</h4>
   ${preview?`<div class="recent-deal-desc product-preview">${preview}</div>`:''}
   <div class="recent-deal-tags"><span class="recent-deal-tag">${region}</span><span class="recent-deal-tag">${qty}</span><span class="recent-deal-tag">${unitPrice} / бирлик</span></div>
   <div class="recent-deal-foot">
     <div class="recent-deal-party"><div>Буюртмачи: ${customer}</div><div>Етказиб берувчи: ${supplier}</div></div>
     <div class="recent-deal-price"><strong>${total}</strong><small>сотилиш қиймати</small></div>
   </div>
 </article>`;
}

function bindRecentDealCards(){
 document.querySelectorAll('[data-recent-deal-index]').forEach(el=>{
   const open=()=>openRecentDeal(Number(el.dataset.recentDealIndex));
   el.onclick=open;
   el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
 });
}

function renderRecentDealProperties(r,hideExtra=false){
 const blocks=[];
 const addText=(title,val)=>{if(val==null||val==='')return;const text=String(val).trim();if(!text||text==='null'||text==='{}'||text==='[]')return;blocks.push(`<div class="uzbi-deal-properties"><h4>${esc(title)}</h4><div class="uzbi-deal-properties-text">${esc(text)}</div></div>`);};
 const addJson=(title,val)=>{
  if(val==null||val==='')return;let x=val;try{if(typeof x==='string')x=JSON.parse(x)}catch(_){addText(title,val);return}
  if(x==null)return;let rows=[];
  if(Array.isArray(x))x.forEach((it,idx)=>{if(it&&typeof it==='object'){const name=it.property_name||it.name||it.key||it.title||it.label||`Хусусият ${idx+1}`;const value=it.property_value??it.value??it.val??it.text??it.description??'';const unit=it.unit_name||it.unit||it.measure||'';if(String(value).trim()){const vv=String(value).trim(),uu=String(unit||'').trim();const shown=uu&&!vv.toLocaleLowerCase('ru-RU').endsWith(uu.toLocaleLowerCase('ru-RU'))?`${vv} ${uu}`:vv;rows.push([name,shown]);}else Object.entries(it).forEach(([k,v])=>{if(v!=null&&String(v).trim())rows.push([k,v])});}else if(it!=null&&String(it).trim())rows.push([`Хусусият ${idx+1}`,it]);});
  else if(typeof x==='object')Object.entries(x).forEach(([k,v])=>{if(v==null||v==='')return;if(typeof v==='object'){try{v=JSON.stringify(v)}catch(_){v=String(v)}}rows.push([k,v])});
  else{addText(title,x);return}
  if(!rows.length)return;blocks.push(`<div class="uzbi-deal-properties"><h4>${esc(title)}</h4><div class="uzbi-deal-prop-list">${rows.map(([k,v])=>`<div class="uzbi-deal-prop-item"><small>${esc(k)}</small><b>${esc(String(v))}</b></div>`).join('')}</div></div>`);
 };
 addText('Товар тавсифи',r.description);addJson('Товар хусусиятлари',r.properties_json);if(!hideExtra)addJson('Қўшимча атрибутлар',r.attributes_json);return blocks.join('');
}



function renderRecentDealDescriptionOnly(r){
  const val=r?.description;
  if(val==null||val==='')return '';
  const t=String(val).trim();
  if(!t||t==='null'||t==='{}'||t==='[]')return '';
  return `<div class="uzbi-deal-properties">
    <h4>\u0422\u043e\u0432\u0430\u0440 \u0442\u0430\u0432\u0441\u0438\u0444\u0438</h4>
    <div class="uzbi-deal-properties-text">${esc(t)}</div>
  </div>`;
}

function pickField(o,names,def=""){
 for(const n of names){if(o&&o[n]!=null&&o[n]!=="")return o[n];}
 return def;
}
function auctionPropName(x){
 return pickField(x,["property_name","prop_name","name","title","property","param_name","feature_name"],"");
}
function auctionPropValue(x){
 return pickField(x,["property_value","prop_value","value_name","value","val","text_value","value_text","prop_numb","val_numb"],"");
}
function auctionProductNo(x,i=0){
 return String(pickField(x,["product_no","item_no","position_no","no"],i+1));
}
function renderAuctionLotProducts(products,properties,title="Лот таркиби",mode="completed",lotCategory=""){
 if(!Array.isArray(products)||!products.length)return "";
 const props=Array.isArray(properties)?properties:[];
 const rows=products.map((p,i)=>{
   const pno=auctionProductNo(p,i);
   const pprops=props.filter(x=>{
     const xn=String(pickField(x,["product_no","item_no","position_no","no"],""));
     if(xn)return xn===pno;
     const pid=pickField(p,["id","product_id","item_id"],"");
     const xid=pickField(x,["product_id","item_id"],"");
     return pid&&xid&&String(pid)===String(xid);
   });
   let embedded=[];
   for(const key of ["properties_json","product_properties_json","attributes_json"]){
     const raw=p?.[key]; if(!raw)continue;
     try{const v=typeof raw==="string"?JSON.parse(raw):raw;if(Array.isArray(v))embedded=embedded.concat(v)}catch(_){}
   }
   const propRows=[...pprops,...embedded].map(x=>Array.isArray(x)&&x.length>=2?{n:x[0],v:x[1]}:{n:auctionPropName(x),v:auctionPropValue(x)}).filter(x=>x.n||x.v);
   const product=pickField(p,["product_name","name","title"],"—");
   const category=pickField(p,["category_name","category","category_title"],"");
   const code=pickField(p,["product_code","code","mxik_code","ikpu_code"],"—");
   const qty=pickField(p,["quantity","amount","qty"],null);
   const unit=pickField(p,["unit_name","unit","measure_name"],"—");
   const startPrice=pickField(p,["start_unit_price","start_price","initial_unit_price","initial_price","price"],null);
   const contractPrice=pickField(p,["contract_price","unit_price","contract_unit_price","last_price","winner_unit_price"],null);
   let total=pickField(p,["total_amount","total_price","deal_amount","amount_total","contract_amount"],null);
   if(total==null&&qty!=null&&contractPrice!=null)total=Number(qty)*Number(contractPrice);
   const desc=pickField(p,["description","spec","specification","characteristics"],"");
   const propText=propRows.map(x=>`${x.n?String(x.n)+": ":""}${x.v||"—"}`).join(" • ");
   const description=[desc,propText].filter(Boolean).join(" \u2022 ")||"\u2014";
   if(mode==="active"){
     return `<tr>
       <td>${i+1}</td>
       <td class="auction-col-product"><b>${esc(product)}</b><small>Товар коди: ${esc(code)}</small></td>
       <td>${qty!=null?num(qty):"—"}</td>
       <td>${esc(unit)}</td>
       <td>${startPrice!=null?num(startPrice):"—"}</td>
       <td>${(qty!=null&&startPrice!=null)?num(Number(qty)*Number(startPrice)):"—"}</td>
       <td class="auction-col-desc">${esc(description)}</td>
     </tr>`;
   }
   return `<tr>
     <td>${i+1}</td>
     <td class="auction-col-product"><b>${esc(product)}</b><small>Товар коди: ${esc(code)}</small></td>
     <td>${qty!=null?num(qty):"—"}</td>
     <td>${esc(unit)}</td>
     <td>${startPrice!=null?num(startPrice):"—"}</td>
     <td>${contractPrice!=null?num(contractPrice):"—"}</td>
     <td>${total!=null?num(total):"—"}</td>
     <td class="auction-col-desc">${esc(description)}</td>
   </tr>`;
 }).join("");
 return `<section class="auction-lot-composition auction-table-composition">
   <div class="auction-composition-head">
     <div>
       <span>\u041b\u041e\u0422 \u0422\u0410\u0420\u041a\u0418\u0411\u0418</span>
       <h4>${esc(title)}</h4>

     </div>
     <b>${num(products.length)} \u0442\u0430 \u0442\u043e\u0432\u0430\u0440</b>
   </div>
   <div class="auction-table-scroll"><table class="auction-products-table ${mode==="active"?"auction-products-active":""}">
    <thead>${mode==="active"
      ?`<tr><th>№</th><th>ТОВАР НОМИ</th><th>МИҚДОР</th><th>БИРЛИК</th><th>СТАРТ НАРХ / БИРЛИК</th><th>БОШЛАНҒИЧ ЖАМИ</th><th>ТАВСИФ / ХУСУСИЯТЛАР</th></tr>`
      :`<tr><th>№</th><th>ТОВАР НОМИ</th><th>МИҚДОР</th><th>БИРЛИК</th><th>СТАРТ НАРХ / БИРЛИК</th><th>КОНТРАКТ НАРХ / БИРЛИК</th><th>ЖАМИ</th><th>ТАВСИФ / ХУСУСИЯТЛАР</th></tr>`}
    </thead>
    <tbody>${rows}</tbody>
    ${mode==="active"?`
    <tfoot>
      <tr class="auction-lot-total-row auction-active-total-row">
        <td colspan="5"><strong>\u0416\u0410\u041c\u0418</strong></td>
        <td class="auction-lot-grand-total">${num(products.reduce((sum,p)=>{
          const q=pickField(p,["quantity","amount","qty"],null);
          const sp=pickField(p,["start_unit_price","start_price","initial_unit_price","initial_price","price"],null);
          let t=pickField(p,["start_cost","initial_cost","start_amount","initial_amount"],null);
          if(t==null&&q!=null&&sp!=null)t=Number(q)*Number(sp);
          return sum+(Number(t)||0);
        },0))}</td>
        <td></td>
      </tr>
    </tfoot>`:""}
    ${mode!=="active"?`
    <tfoot>
       <tr class="auction-lot-total-row">
         <td colspan="6"><strong>\u0416\u0410\u041c\u0418</strong></td>
         <td class="auction-lot-grand-total">${num(products.reduce((sum,p)=>{
          const q=pickField(p,["quantity","amount","qty"],null);
          const cp=pickField(p,["contract_price","unit_price","contract_unit_price","last_price","winner_unit_price"],null);
          let t=pickField(p,["total_amount","total_price","deal_amount","amount_total","contract_amount"],null);
          if(t==null&&q!=null&&cp!=null)t=Number(q)*Number(cp);
          return sum+(Number(t)||0);
        },0))}</td>
        <td></td>
         <td></td>
       </tr>
     </tfoot>`:""}
   </table></div>
 </section>`;
}

async function loadRecentAuctionLotComposition(r,modal){
 if(String(r?.platform_key||"")!=="auction")return;
 const host=modal.querySelector(".unified-sale-modal .uzbi-deal-detail-grid");
 if(!host)return;
 const loading=document.createElement("div");
 loading.className="auction-composition-loading";
 loading.textContent="Лотдаги бошқа товарлар юкланмоқда…";
 host.appendChild(loading);
 try{
   const p=new URLSearchParams();
   if(r.deal_id!=null)p.set("deal_id",r.deal_id);
   if(r.lot_id!=null)p.set("lot_id",r.lot_id);
   if(r.lot_no!=null)p.set("lot_no",r.lot_no);
   console.log("[AUCTION LOT DETAIL REQUEST]", {
     deal_id:r.deal_id,
     lot_id:r.lot_id,
     lot_no:r.lot_no,
     url:`/api/product-recent/auction-lot-detail?${p.toString()}`
   });
   const d=await get(`/api/product-recent/auction-lot-detail?${p.toString()}`);
   console.log("[AUCTION LOT DETAIL RESPONSE]", d);
   console.log("[AUCTION PRODUCT FIELDS]",
     (d.products||[]).map((x,i)=>({
       n:i+1,
       keys:Object.keys(x||{}),
       code_like:Object.fromEntries(
         Object.entries(x||{}).filter(([k,v])=>
           /code|mxik|ikpu|class|catalog|tnved|product|item/i.test(k)
         )
       )
     }))
   );
   loading.remove();
   if(d.products?.length){
     host.insertAdjacentHTML(
       "beforeend",
       renderAuctionLotProducts(
         d.products,
         d.properties,
         "\u0423\u0448\u0431\u0443 \u0430\u0443\u043a\u0446\u0438\u043e\u043d \u043b\u043e\u0442\u0438\u0434\u0430\u0433\u0438 \u0431\u0430\u0440\u0447\u0430 \u0442\u043e\u0432\u0430\u0440\u043b\u0430\u0440",
         "completed",
         r.category_name || r.category || ""
       )
     );
   }
 }catch(e){
   loading.innerHTML=`<span class="error-text">Лот таркибини юклаб бўлмади: ${esc(e.message)}</span>`;
 }
}


/* BIDATA XT NATIONAL ACTIVE+RECENT ICONS v1 */
function bidataBlockIcon(type){
  const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

  const p={
    lot:`<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>`,

    calendar:`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>`,

    code:`<path d="M5 4v16M9 4v16M13 4v16M18 4v16M21 4v16"/>`,

    qty:`<path d="M5 7l7-4 7 4-7 4z"/><path d="M5 7v10l7 4 7-4V7M12 11v10"/>`,

    unit:`<path d="M4 18L18 4l2 2L6 20z"/><path d="M12 10l2 2M9 13l2 2M15 7l2 2"/>`,

    price:`<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v5c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 10v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>`,

    total:`<path d="M3 7h18v12H3z"/><path d="M7 7V5h10v2"/><circle cx="12" cy="13" r="2"/>`,

    category:`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,

    status:`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>`,

    tag:`<path d="M3 12l9-9h7l2 2v7l-9 9z"/><circle cx="16" cy="8" r="1"/>`,

    factory:`<path d="M3 21V9l6 3V8l6 4V5h6v16z"/><path d="M7 17h2M12 17h2M17 17h2"/>`,

    region:`<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="9" r="2"/>`,

    address:`<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>`,

    inn:`<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16c.8-1.7 4.2-1.7 5 0M13 10h5M13 14h5"/>`,

    text:`<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>`
  };

  return `<span class="bidata-block-icon bidata-block-icon-${type}"><svg ${common}>${p[type]||p.text}</svg></span>`;
}

function openRecentDeal(i){
 const r=__uzbiRecentDeals[i]; if(!r)return;
 document.getElementById('uzbiDealModal')?.remove();

 const modal=document.createElement('div');
 modal.id='uzbiDealModal';
 modal.className='uzbi-deal-modal';

 const roundSum=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(Number(v||0)));
 const dateText=(()=>{const x=String(r.date||'').slice(0,10);if(!x)return '—';const m=x.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:x})();
 const qtyText=r.quantity!=null?`${num(r.quantity)}${r.unit_name?' '+esc(r.unit_name):''}`:'—';

 const category=String(r.category_name||'').trim();
 const status=String(r.status||r.source_status||'').trim();
 const customerInn=String(r.customer_inn||'').trim();
 const supplierInn=String(r.supplier_inn||r.provider_inn||'').trim();
 const storeKey=String(r.platform_key||'').toLowerCase();
 const isShop=storeKey==='shop';
 const isNational=storeKey==='national';
 const isCompactStore=isShop||isNational;

 let body='';

 if(isCompactStore){
   body=`
   <div class="shop-compact-summary">
     <div class="shop-compact-top">
       <div class="shop-compact-cell"><small>${bidataBlockIcon('lot')}Лот рақами</small><b>${esc(r.lot_no||'—')}</b></div>
       <div class="shop-compact-cell"><small>${bidataBlockIcon('calendar')}Сана</small><b>${esc(dateText)}</b></div>
       <div class="shop-compact-cell"><small>${bidataBlockIcon('code')}Товар коди</small><b>${esc(r.product_code||'—')}</b></div>
       <div class="shop-compact-cell"><small>${bidataBlockIcon('qty')}Миқдор</small><b>${r.quantity!=null?num(r.quantity):'?'}</b></div>
       <div class="shop-compact-cell"><small>${bidataBlockIcon('unit')}Ўлчов бирлиги</small><b>${esc(r.unit_name||'—')}</b></div>
     </div>
     <div class="shop-compact-bottom">
       <div class="shop-compact-cell shop-price"><small>${bidataBlockIcon('price')}Бирлик баҳоси</small><b>${r.unit_price!=null?roundSum(r.unit_price):'—'}</b></div>
       <div class="shop-compact-cell shop-price"><small>${bidataBlockIcon('total')}Сотилиш қиймати</small><b>${r.total_value!=null?roundSum(r.total_value):'—'}</b></div>
       <div class="shop-compact-cell shop-category"><small>${bidataBlockIcon('category')}Категория</small><b>${esc(category||'—')}</b></div>
       <div class="shop-compact-cell shop-status"><small>${bidataBlockIcon('status')}Битим ҳолати</small><span>${esc(status||'—')}</span></div>
     </div>
   </div>

   <div class="shop-compact-parties">
     <div class="shop-party-card">
       <small>${bidataBlockIcon('factory')}Буюртмачи</small>
       <b>${esc(r.customer||'—')}</b>
       ${customerInn?`<em>СТИР: <strong>${esc(customerInn)}</strong></em>`:''}
     </div>
     <div class="shop-party-card">
       <small>${bidataBlockIcon('region')}Регион</small>
       <b>${esc(r.region||'—')}</b>
     </div>
     <div class="shop-party-card">
       <small>${bidataBlockIcon('factory')}Етказиб берувчи</small>
       <b>${esc(r.supplier||'—')}</b>
       ${supplierInn?`<em>СТИР: <strong>${esc(supplierInn)}</strong></em>`:''}
     </div>
   </div>

   ${renderRecentDealDescriptionOnly(r)}`;
 }else{
   const categoryStatus=(category||status)?`
     <div class="shop-card-category-status">
       ${category?`<div class="shop-card-category"><small>${bidataBlockIcon('category')}Категория</small><b>${esc(category)}</b></div>`:''}
       ${status?`<div class="shop-card-status"><small>${bidataBlockIcon('status')}Битим ҳолати</small><span>${esc(status)}</span></div>`:''}
     </div>`:'';

   body=`<div class="xt-sale-summary">
     <div class="xt-sale-cell"><small>${bidataBlockIcon('lot')}Лот рақами</small><b>${esc(r.lot_no||'—')}</b></div>
     <div class="xt-sale-cell"><small>${bidataBlockIcon('calendar')}Сана</small><b>${esc(dateText)}</b></div>
     <div class="xt-sale-cell"><small>${bidataBlockIcon('code')}Товар коди</small><b>${esc(r.product_code||'—')}</b></div>
     <div class="xt-sale-cell"><small>${bidataBlockIcon('qty')}Миқдор</small><b>${r.quantity!=null?num(r.quantity):'\u2014'}</b></div>
     <div class="xt-sale-cell"><small>${bidataBlockIcon('unit')}Ўлчов бирлиги</small><b>${esc(r.unit_name||'—')}</b></div>
     <div class="xt-sale-cell price"><small>${bidataBlockIcon('price')}Бирлик баҳоси</small><b>${r.unit_price!=null?roundSum(r.unit_price):'—'}</b></div>
     <div class="xt-sale-cell total"><small>${bidataBlockIcon('total')}Сотилиш қиймати</small><b>${r.total_value!=null?roundSum(r.total_value):'—'}</b></div>
     ${category?`<div class="xt-sale-cell compact-category"><small>${bidataBlockIcon('category')}\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f</small><b>${esc(category)}</b></div>`:''}
     ${status && storeKey!=='auction'?`<div class="xt-sale-cell compact-status"><small>${bidataBlockIcon('status')}\u0411\u0438\u0442\u0438\u043c \u04b3\u043e\u043b\u0430\u0442\u0438</small><span>${esc(status)}</span></div>`:''}
   </div>
   <div class="xt-party-grid">
     <div class="xt-party-card">
       <small>${bidataBlockIcon('factory')}Буюртмачи</small><b>${esc(r.customer||'—')}</b>
       ${customerInn?`<em>СТИР: <strong>${esc(customerInn)}</strong></em>`:''}
     </div>
     <div class="xt-party-card"><small>${bidataBlockIcon('region')}Регион</small><b>${esc(r.region||'—')}</b></div>
     <div class="xt-party-card">
       <small>${bidataBlockIcon('factory')}Етказиб берувчи</small><b>${esc(r.supplier||'—')}</b>
       ${supplierInn?`<em>СТИР: <strong>${esc(supplierInn)}</strong></em>`:''}
     </div>

     ${storeKey==='auction' && status?`
     <div class="xt-party-card auction-status-party-card">
       <small>${bidataBlockIcon('status')}\u0411\u0438\u0442\u0438\u043c \u04b3\u043e\u043b\u0430\u0442\u0438</small>
       <b>${esc(status)}</b>
     </div>`:''}

   </div>
   ${(storeKey==='xt_auction'||storeKey==='auction')?renderRecentDealDescriptionOnly(r):renderRecentDealProperties(r,false)}`;
 }

 modal.innerHTML=`<div class="uzbi-deal-modal-card unified-sale-modal${isCompactStore?' shop-compact-modal':''}${isNational?' national-compact-modal':''}${storeKey==='auction'?' auction-card-30d':''}" role="dialog" aria-modal="true">
   <div class="uzbi-deal-modal-head">
     <div class="unified-sale-head">
       ${isCompactStore?'':brandLogo(r.platform_key,null,"unified-sale-logo")}
       <div><span>${esc(cleanPlatformName(r)||r.platform||'\u0421\u0410\u0412\u0414\u041e')}</span><h3>${esc(r.product_name||'Савдо маълумоти')}</h3></div>
     </div>
     <button class="uzbi-deal-modal-close" type="button" aria-label="\u0422\u0435\u043d\u0434\u0435\u0440 \u0416\u0410\u041c\u0418? \u043c\u0430\u044a\u043b\u0443\u043c\u043e\u0442\u043b\u0430\u0440\u0438\u043d\u0438 \u043e\u0447\u0438\u0448">×</button>
   </div>
   <div class="uzbi-deal-detail-grid">${body}</div>
 </div>`;

 document.body.appendChild(modal);

 // Existing auction-only detail loading is preserved.
 loadRecentAuctionLotComposition(r,modal);

 const close=()=>modal.remove();
 modal.querySelector('.uzbi-deal-modal-close').onclick=close;
 modal.onclick=e=>{if(e.target===modal)close()};
 const onKey=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',onKey)}};
 document.addEventListener('keydown',onKey);
}

// ===== /bidata v9 compact modal =====


// ===== bidata ANALYTICS CONCLUSION V2.1 =====
const __uzbiActiveProductCache=new Map();
function getActiveProductData(q){
 const key=fixText(q||"").toLocaleLowerCase('ru-RU').trim();
 if(!key)return Promise.resolve({count:0,amount:0,breakdown:[],rows:[]});
 if(!__uzbiActiveProductCache.has(key))__uzbiActiveProductCache.set(key,get(`/api/product-active-lots?q=${encodeURIComponent(q)}&limit=50`).catch(e=>{__uzbiActiveProductCache.delete(key);throw e}));
 return __uzbiActiveProductCache.get(key);
}
function _clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function _pct(v,d=0){return Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(d)}%`:'—'}
function _monthName(m){return ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][Number(m)]||'—'}
function _fmtPrice(v){return Number(v)>0?money(v):'—'}
function _safePct(v){return Number.isFinite(Number(v))?Number(v):null}
function _concLabel(v){v=Number(v||0);return v>=70?'ЖУДА ЮҚОРИ':v>=50?'ЮҚОРИ':v>=30?'ЎРТАЧА':'ТАРҚОҚ'}
function _profileLabel(c30,c90,activeCount,activeAmount,largestShare){
 const avgActive=activeCount?activeAmount/activeCount:0;
 if(activeCount>0&&largestShare>=75)return 'ЙИРИК ЛОТГА БОҒЛАНГАН БОЗОР';
 if(c30>=80&&activeCount>=15&&avgActive<5e6)return 'ЮҚОРИ АЙЛАНМАЛИ / ПАСТ ЧЕКЛИ БОЗОР';
 if(c30>=50&&activeCount>=8)return 'ОММАВИЙ РАҚОБАТЛИ БОЗОР';
 if(c90<30)return 'ТОР / КАМ БИТИМЛИ СЕГМЕНТ';
 return 'БАРҚАРОР ЎРТА СЕГМЕНТ';
}
function _platformShort(k){
 return {shop:'Электрон дўкон',national:'Миллий дўкон',auction:'UZEX аукцион',xt_auction:'XT аукцион',xt_national:'XT миллий дўкон'}[k]||k||'—';
}
function _participantRows(rows){
 if(!rows?.length)return '<div class="v21-empty">Маълумот етарли эмас</div>';
 const max=Math.max(1,...rows.map(x=>Number(x.share_pct||0)));
 return rows.map((x,i)=>{
   const platformText=(x.platforms||[]).map(p=>`${_platformShort(p.key)} ${num(p.count||0)}`).join(' • ');
   const inn=x.inn?`СТИР: ${esc(x.inn)}`:'СТИР мавжуд эмас';
   return `<div class="v21-participant"><div class="v21-p-rank">${i+1}</div><div class="v21-p-main"><b title="${esc(x.name||'—')}">${esc(x.name||'—')}</b><div><i style="width:${Math.max(3,Number(x.share_pct||0)/max*100)}%"></i></div><small>${num(x.count||0)} та • ${money(x.amount||0)} • ${inn}</small>${platformText?`<small class="v22-platform-breakdown">${esc(platformText)}</small>`:''}</div><strong>${Number(x.share_pct||0).toFixed(1)}%</strong></div>`;
 }).join('');
}
function _participantScopeHtml(scope){
 const markets=scope?.markets||[];
 if(!markets.length)return '';
 return `<div class="v22-scope"><div><b>TOP-5 қамрови:</b> 5 та савдо йўналиши • сўнгги ${num(scope.window_days||90)} кун • ${num(scope.deals_count||0)} та савдо</div><div class="v22-market-chips">${markets.map(m=>`<span class="${Number(m.count||0)?'has-data':'no-data'}"><b>${esc(_platformShort(m.key))}</b> ${num(m.count||0)} та</span>`).join('')}</div><small>Ташкилотлар аввал СТИР/ИНН бўйича, СТИР йўқ бўлса нормаллаштирилган номи бўйича бирлаштирилади.</small></div>`;
}
function buildProductConclusionV2(d,activeData=null){
 const x=d.decision_v2||{},dem=x.demand||{},pr=x.price||{},se=x.season||{},cap=x.capacity||{},regions=x.regions||[];
 const topCustomers=x.top_customers||[],topSuppliers=x.top_suppliers||[],conc=x.concentration||{},participantScope=x.participant_scope||{},confidence=x.confidence||{level:'low',label:'ПАСТ'};
 const activeKnown=!!activeData,activeRows=activeKnown?(activeData.rows||[]):[];
 const demandData=activeKnown?(activeData.demand||{}):{},supplyData=activeKnown?(activeData.supply||{}):{};
 const demandRows=activeKnown?(demandData.rows||[]):[];
 const demandCount=activeKnown?Number(demandData.count||0):0,demandAmount=activeKnown?Number(demandData.amount||0):0;
 const supplyCount=activeKnown?Number(supplyData.count||0):0,supplyAmount=activeKnown?Number(supplyData.amount||0):0;
 const activeCount=activeKnown?Number(activeData.count||0):0,activeAmount=activeKnown?Number(activeData.amount||0):0;
 const ch30=_safePct(dem.change30_pct),ch7=_safePct(dem.change7_pct),ch90=_safePct(dem.change90_pct),pchg=_safePct(pr.change30_pct);
 const c30=Number(dem.last30?.count||d.recent_summary?.count||0),c90=Number(dem.last90?.count||0);
 const daily30=Number(dem.daily_velocity30||0),daily90=Number(dem.daily_velocity90||0),acceleration=daily90>0?(daily30/daily90-1)*100:null;
 const priceSpread=(Number(pr.p25_90)>0&&Number(pr.p75_90)>0&&Number(pr.median90)>0)?(Number(pr.p75_90)-Number(pr.p25_90))/Number(pr.median90)*100:null;
 let demandScore=c30>=150?25:c30>=60?22:c30>=25?18:c30>=10?14:c30>=3?9:c30?5:0;
 let trendScore=ch30==null?10:ch30>=25?20:ch30>=8?17:ch30>=-8?13:ch30>=-25?8:3;
 let priceScore=priceSpread==null?8:priceSpread<=20?15:priceSpread<=40?12:priceSpread<=70?9:priceSpread<=110?6:3;
 let seasonScore=Math.round(_clamp(Number(se.current_strength_pct||0)/100,0,1)*15),activeScore=activeKnown?(demandCount>=10?25:demandCount>=5?20:demandCount>=2?14:demandCount>=1?8:0):0;
 const historical=demandScore+trendScore+priceScore+seasonScore,score=activeKnown?historical+activeScore:Math.round(historical/75*100);
 const amountChange=(cur,prev)=>prev>0?((cur-prev)/prev*100):(cur>0?100:null);
 const a7=Number(dem.last7?.amount||0),pa7=Number(dem.prev7?.amount||0);
 const a30=Number(dem.last30?.amount||0),pa30=Number(dem.prev30?.amount||0);
 const a90=Number(dem.last90?.amount||0),pa90=Number(dem.prev90?.amount||0);
 const ach7=amountChange(a7,pa7),ach30=amountChange(a30,pa30),ach90=amountChange(a90,pa90);

 let demandState='ТАЛАБ ЧЕКЛАНГАН',demandTone='warn';

 if(c30>=15){
   const shortRecovery=
     ch7!=null&&ach7!=null&&
     ch7>=100&&ach7>=50&&
     (
       (ch90!=null&&ch90<=-25)||
       (ach90!=null&&ach90<=-25)||
       (ch30!=null&&ach30!=null&&ch30>=0&&ach30<0)
     );

   const strongDemand=
     ch30!=null&&ach30!=null&&
     ch30>=0&&ach30>=0&&
     (ch90==null||ch90>=-25)&&
     (ach90==null||ach90>=-25);

   const decliningDemand=
     (
       ch30!=null&&ach30!=null&&
       ch30<0&&ach30<0
     )||
     (
       ch90!=null&&ach90!=null&&
       ch90<=-25&&ach90<=-25&&
       !(ch7!=null&&ach7!=null&&ch7>=100&&ach7>=50)
     );

   if(shortRecovery){
     demandState='ТАЛАБ ТИКЛАНМОҚДА';
     demandTone='good';
   }else if(strongDemand){
     demandState='ТАЛАБ КУЧЛИ';
     demandTone='good';
   }else if(decliningDemand){
     demandState='ТАЛАБ ПАСАЙМОҚДА';
     demandTone='warn';
   }else{
     demandState='ТАЛАБ БАРҚАРОР';
     demandTone='good';
   }
 }
 let priceState='НАРХ БЎЙИЧА МАЪЛУМОТ ЧЕКЛАНГАН',priceTone='neutral';
 if(Number(pr.samples90||0)>=5){if(priceSpread!=null&&priceSpread<=40)priceState=pchg!=null&&pchg>8?'НАРХ БАРҚАРОР ВА ЎСИШДА':'НАРХ НИСБАТАН БАРҚАРОР';else priceState=pchg!=null&&pchg<-8?'НАРХ ПАСАЙИШДА, ТЕБРАНИШ ЮҚОРИ':'НАРХЛАРДА СЕЗИЛАРЛИ ФАРҚ БОР';priceTone=(priceSpread!=null&&priceSpread<=40)?'good':'warn'}
 const neutralMonthShare=100/12;
 const curShare=Number(se.current_share_pct||0),nextShare=Number(se.next_month_share_pct||0);
 const curSeasonIndex=curShare/neutralMonthShare*100,nextSeasonIndex=nextShare/neutralMonthShare*100;
 let timingState=curSeasonIndex>=110?'ҲОЗИР КУЧЛИ МАВСУМ':curSeasonIndex>=90?'ҲОЗИР ОДАТИЙ МАВСУМ':'ҲОЗИР МАВСУМИЙ ФАОЛЛИК ПАСТРОҚ';if(nextSeasonIndex>=110&&nextSeasonIndex>curSeasonIndex+10)timingState=`${_monthName(se.next_month)} ОЙИДА ТАЛАБ КУЧАЙИШИ КУТИЛАДИ`;
 const largest=demandRows.reduce((best,r)=>Number(r.amount||0)>Number(best?.amount||0)?r:best,null),largestShare=demandAmount>0&&largest?Number(largest.amount||0)/demandAmount*100:0;
 const activeRegions={};demandRows.forEach(r=>{const k=fixText(r.region||'').trim();if(k)activeRegions[k]=(activeRegions[k]||0)+1});const activeTopRegion=Object.entries(activeRegions).sort((a,b)=>b[1]-a[1])[0];
 const marketProfile=_profileLabel(c30,c90,demandCount,demandAmount,largestShare),supplierConc=Number(conc.suppliers_top5_share_pct||0),customerConc=Number(conc.customers_top5_share_pct||0);
 let action='КУЗАТИШ',tone='mid',headline='Бозорни кузатиб, шартларни солиштиринг';
 if(confidence.level==='low'&&activeKnown&&demandCount>0){action='ТЕКШИРИБ КИРИШ';tone='mid';headline='Имконият бор, аммо маълумот ишончи паст'}
 else if(activeKnown&&demandCount>0&&largestShare>=75&&demandAmount>=100e6){action='ЙИРИК ЛОТНИ ТЕКШИРИШ';tone='good';headline='Йирик имконият бор — асосий лотга мослик ҳал қилувчи'}
 else if(activeKnown&&demandCount>0&&c30>=15&&ch30!=null&&ch30>=-15){action='ҲОЗИР КИРИШ';tone='high';headline='Ҳозир сотувга кириш учун асос бор'}
 else if(activeKnown&&demandCount>0&&c30>=30){action='НАРХ БИЛАН КИРИШ';tone='good';headline='Сотиш мумкин — рақобатбардош нарх ҳал қилувчи'}
 else if(activeKnown&&demandCount>0){action='ТАНЛАБ КИРИШ';headline='Фаол имконият бор, аммо ҳар бир лотни танлаб киринг'}
 else if(activeKnown&&demandCount===0&&c30>=30){headline='Талаб бор, лекин ҳозир фаол харид топилмади'}else if(activeKnown){action='КУТИШ';tone='low';headline='Ҳозир фаол сотув сигнали заиф'};
 const reasons=[`30 кунда ${num(c30)} та савдо`];if(ch30!=null)reasons.push(`талаб ${_pct(ch30)}`);if(pchg!=null)reasons.push(`медиана нарх ${_pct(pchg)}`);if(activeKnown)reasons.push(`${num(demandCount)} та фаол лот • ${money(demandAmount)}`);reasons.push(`ишонч: ${confidence.label||'—'}`);
 const demandSentence=ch30==null?`Сўнгги 30 кунда ${num(c30)} та савдо қайд этилган.`:`Сўнгги 30 кунда ${num(c30)} та савдо қайд этилган; олдинги 30 кунга нисбатан талаб ${Math.abs(ch30).toFixed(0)}% ${ch30>=0?'ошган':'пасайган'}.`;
 const priceSentence=Number(pr.median30)>0?`30 кунлик медиана нарх ${money(pr.median30)}${pchg!=null?`, олдинги даврга нисбатан ${Math.abs(pchg).toFixed(1)}% ${pchg>=0?'юқори':'паст'}`:''}.`:'Нарх трендини ишончли баҳолаш учун намуна етарли эмас.';
 const activeSentence=activeKnown?(demandCount?`Ҳозир ${num(demandCount)} та фаол харид бор, умумий қиймати ${money(demandAmount)}.`:'Ҳозир ушбу аниқ товар бўйича фаол харид топилмади.'):'Фаол харидлар текширилмоқда.';
 let recommendation='Талаб ва фаол лотларни кузатиб боринг.';
 if(confidence.level==='low')recommendation='Тарихий савдолар сони кам, шунинг учун нарх ва талаб бўйича қатъий хулоса бериш хавфли. Фаол лотнинг аниқ спецификацияси, миқдори ва етказиб бериш шартларини биринчи навбатда текширинг.';
 else if(largestShare>=75&&activeKnown&&demandCount>0)recommendation=`Фаол имкониятларнинг ${largestShare.toFixed(0)}% қисми энг йирик битта лотга тўғри келмоқда. Умумий бозор статистикасидан кўра шу асосий лотга техник ва логистик мосликни текшириш устувор.`;
 else if(marketProfile.includes('ЮҚОРИ АЙЛАНМАЛИ'))recommendation='Бу юқори айланмали, нисбатан паст чекли бозор. Катта маржадан кўра рақобатбардош нарх, кўп лотларда иштирок ва тез товар айланмаси стратегияси мақбул.';
 else if(supplierConc>=60)recommendation='Талаб бор, аммо етказиб берувчилар концентрацияси юқори. Янги иштирокчи учун нарх, спецификация ёки етказиб бериш шарти бўйича аниқ устунлик керак.';
 else if(action==='ҲОЗИР КИРИШ')recommendation='Фаол лотларни биринчи навбатда кўриб чиқинг. Тарихий медиана ва 90 кунлик асосий нарх диапазонидан чиқмасдан, спецификацияси мос лотларга рақобатбардош таклиф тайёрлаш мақсадга мувофиқ.';
 else if(action==='НАРХ БИЛАН КИРИШ')recommendation='Талаб ҳали юқори, аммо динамика юмшаган. Юқори маржадан кўра айланма ва рақобатбардош нархга урғу бериб, ҳозирги фаол лотларни танлаб иштирок этинг.';
 else if(action==='ТАНЛАБ КИРИШ')recommendation='Бозор сиғими чекланганроқ. Таннарх ва етказиб бериш шартлари қулай бўлган фаол лотларнигина танлаб кириш мақсадга мувофиқ.';
 const anomaly=!!x.price_anomaly;
 return {score,action,tone,headline,demandState,demandTone,priceState,priceTone,timingState,recommendation,demandSentence,priceSentence,activeSentence,reasons,demandScore,trendScore,priceScore,seasonScore,activeScore,activeKnown,activeCount:demandCount,activeAmount:demandAmount,largest,largestShare,activeTopRegion,regions,pr,se,cap,dem,ch30,ch7,ch90,pchg,acceleration,priceSpread,c30,c90,topCustomers,topSuppliers,supplierConc,customerConc,customerAmountConc:Number(conc.customers_top5_amount_share_pct||0),supplierAmountConc:Number(conc.suppliers_top5_amount_share_pct||0),participantScope,confidence,anomaly,marketProfile};
}
function renderProductConclusion(d,activeData=null){
 const x=buildProductConclusionV2(d,activeData),r=x.regions||[],pr=x.pr||{},se=x.se||{};const maxShare=Math.max(1,...r.slice(0,5).map(z=>Number(z.share_pct||0)));
 const regionHtml=r.length?r.slice(0,5).map((z,i)=>`<div class="v2-region-row"><b>${i+1}. ${esc(z.region||'—')}</b><div><i style="width:${Math.max(3,Number(z.share_pct||0)/maxShare*100)}%"></i></div><span>${Number(z.share_pct||0).toFixed(1)}% • ${num(z.count||0)} та</span></div>`).join(''):'<div class="v2-empty">Регион бўйича маълумот етарли эмас</div>';
 const strongest=(se.strongest_months||[]).map(z=>_monthName(z.month)).join(', ')||'—',competitiveLow=Number(pr.p25_90||0),competitiveHigh=Number(pr.median90||0);
 return `<section class="uzbi-conclusion-v2 tone-${x.tone}" id="uzbiProductConclusion">
 <div class="v2-decision-head"><div><span class="v2-kicker">bidata ANALITIK XULOSASI • V2.2</span><div class="v2-action-line"><span class="v2-action">${esc(x.action)}</span><h3>${esc(x.headline)}</h3></div><p>${esc(x.demandSentence)} ${esc(x.priceSentence)} ${esc(x.activeSentence)}</p><div class="v21-profile-line"><span>БОЗОР ТУРИ: <b>${esc(x.marketProfile)}</b></span><span class="confidence ${x.confidence.level}">ИШОНЧ: <b>${esc((x.confidence.level==='high'?'\u042E\u049A\u041E\u0420\u0418':x.confidence.level==='medium'?'\u040E\u0420\u0422\u0410':x.confidence.level==='low'?'\u041F\u0410\u0421\u0422':x.confidence.label)||'—')}</b></span>${x.anomaly?'<span class="anomaly">⚠ НАРХ АНОМАЛИЯСИ</span>':''}</div></div><div class="v2-score"><small>ИЧКИ БАҲО</small><b>${num(x.score)}<em>/100</em></b><span>ёрдамчи score</span></div></div>
 <div class="v2-core-signals"><article class="${x.demandTone}"><small>ТАЛАБ ХУЛОСАСИ</small><b>${esc(x.demandState)}</b><p>7 кун: ${num(x.dem.last7?.count||0)} • 30 кун: ${num(x.c30)} • 90 кун: ${num(x.c90)}</p></article><article class="${x.priceTone}"><small>НАРХ ХУЛОСАСИ</small><b>${esc(x.priceState)}</b><p>30 кун медиана: ${_fmtPrice(pr.median30)} ${x.pchg!=null?`• ${_pct(x.pchg,1)}`:''}</p></article><article><small>ҚАЧОН СОТИШ</small><b>${esc(x.timingState)}</b><p>Энг кучли ойлар: ${esc(strongest)}</p></article><article><small>БОЗОР СИҒИМИ</small><b>${x.cap.level==='high'?'КАТТА':x.cap.level==='medium'?'ЎРТА':'ТОР СЕГМЕНТ'}</b><p>90 кунда ${num(x.c90)} та • ${money(x.cap.amount90||0)}</p></article></div>
 <div class="v2-analysis-grid"><article class="v2-analysis-card v2-price-card"><div class="v2-card-head"><span>💰</span><div><small>НАРХ СТРАТЕГИЯСИ</small><h4>Қайси нарх зонасида рақобат бор?</h4></div></div><div class="v2-price-metrics"><div><small>30 кун медиана</small><b>${_fmtPrice(pr.median30)}</b></div><div><small>90 кун медиана</small><b>${_fmtPrice(pr.median90)}</b></div><div><small>90 кун асосий диапазон</small><b>${competitiveLow&&Number(pr.p75_90)?`${money(competitiveLow)} — ${money(pr.p75_90)}`:'—'}</b></div><div><small>Рақобат зонаси*</small><b>${competitiveLow&&competitiveHigh?`${money(competitiveLow)} — ${money(competitiveHigh)}`:'—'}</b></div></div>${x.anomaly?'<div class="v21-warning">⚠ 30 кунлик медиана нарх олдинги даврдан кескин фарқ қилади. Турли марка, модель ёки спецификациялар аралашган бўлиши мумкин.</div>':''}<p class="v2-note">* Тарихий нархлар бўйича ориентир. Аниқ марка, модель, техник хусусият ва етказиб бериш шарти нархга таъсир қилади.</p></article><article class="v2-analysis-card"><div class="v2-card-head"><span>📍</span><div><small>ТАЛАБ ГЕОГРАФИЯСИ</small><h4>Қайси ҳудудларда кўпроқ харид қилинган?</h4></div></div>${regionHtml}</article><article class="v2-analysis-card"><div class="v2-card-head"><span>🎯</span><div><small>ҲОЗИРГИ ИМКОНИЯТ</small><h4>Фаол харидлар</h4></div></div><div class="v2-active-big"><b>${x.activeKnown?num(x.activeCount):'…'}</b><span>та фаол лот</span></div><div class="v2-active-value">${x.activeKnown?money(x.activeAmount):'текширилмоқда…'}</div>${x.largest?`<p>Энг катта лот: <b>${money(x.largest.amount||0)}</b> • жами сумманинг <b>${x.largestShare.toFixed(0)}%</b>${x.largest.region?` • ${esc(x.largest.region)}`:''}</p>`:''}${x.activeTopRegion?`<p>Фаол лотлар энг кўп: <b>${esc(x.activeTopRegion[0])}</b> (${num(x.activeTopRegion[1])} та)</p>`:''}<button type="button" class="btn primary uzbi-opportunity-btn" data-open-active-conclusion ${x.activeKnown&&x.activeCount===0?'disabled':''}>Фаол харидларни кўриш →</button></article></div>
 ${_participantScopeHtml(x.participantScope)}
 <div class="v21-participant-grid"><article><div class="v21-list-head"><div><small>🏢 ТАЛАБ МАНБАСИ</small><h4>TOP-5 буюртмачилар</h4></div><span>Савдо <b>${x.customerConc.toFixed(1)}%</b> • Сумма <b>${x.customerAmountConc.toFixed(1)}%</b></span></div>${_participantRows(x.topCustomers)}<div class="v21-conclusion">Буюртмачилар концентрацияси: <b>${_concLabel(x.customerConc)}</b> • 5 платформа умумий рейтинги</div></article><article><div class="v21-list-head"><div><small>🏭 РАҚОБАТ МУҲИТИ</small><h4>TOP-5 етказиб берувчилар</h4></div><span>Савдо <b>${x.supplierConc.toFixed(1)}%</b> • Сумма <b>${x.supplierAmountConc.toFixed(1)}%</b></span></div>${_participantRows(x.topSuppliers)}<div class="v21-conclusion">Етказиб берувчилар концентрацияси: <b>${_concLabel(x.supplierConc)}</b> • 5 платформа умумий рейтинги</div></article></div>
 <div class="v2-final-recommendation"><div class="v2-rec-icon">✓</div><div><span>bidata ЯКУНИЙ ТАВСИЯСИ</span><h4>${esc(x.headline)}</h4><p>${esc(x.recommendation)}</p><div class="v2-reasons">${x.reasons.map(z=>`<span>${esc(z)}</span>`).join('')}<span>TOP-5 етказиб берувчи: ${x.supplierConc.toFixed(0)}%</span>${x.largestShare>=50?`<span>энг катта лот: ${x.largestShare.toFixed(0)}%</span>`:''}</div></div></div>
 <div class="v2-method">Манба: bidata маҳаллий fact_deals ва фаол лотлар базалари. Талаб 7/30/90 кун, нарх 30/90 кун, регионлар ва иштирокчилар 90 кун, тарихий мавсумийлик ва фаол лот концентрацияси бўйича ҳисобланади.</div></section>`;
}
function bindConclusionActiveButton(){const b=document.querySelector('[data-open-active-conclusion]');if(b)b.onclick=()=>document.querySelector('[data-product-view="active"]')?.click()}
async function hydrateProductConclusion(d){if(!document.getElementById('uzbiProductConclusion'))return;try{const a=await getActiveProductData(fixText(d.query));const activeQuick=document.querySelector('[data-product-view="active"] small');if(activeQuick)activeQuick.textContent=`${num(a.demand?.count||0)} та лот`;const supplyQuick=document.querySelector('[data-product-view="supply"] small');if(supplyQuick)supplyQuick.textContent=`${num(a.supply?.count||0)} \u0442\u0430 \u0442\u0430\u043a\u043b\u0438\u0444`;const h=document.getElementById('uzbiProductConclusion');if(!h)return;h.outerHTML=renderProductConclusion(d,a);bindConclusionActiveButton()}catch(e){console.error('bidata conclusion V2.2 active lots',e)}}
// ===== /bidata ANALYTICS CONCLUSION V2.1 =====

async function runProductAnalytics(){
 const raw=($("#paQ").value||"").trim(); if(!raw)return;
 setSourceContext("xarid.uzex.uz + xt-xarid.uz • товар бўйича тарихий савдолар");
 const box=$("#paResults"); box.innerHTML='<div class="loading">Товар қидирилмоқда…</div>';
 try{
   // 1) canonical product lookup first — fast indexed DB
   const matches=await get(`/api/products/search?q=${encodeURIComponent(raw)}&limit=12`);
   if(!matches.length){
     const activeOnly=await getActiveProductData(raw);
     const activeRows=(activeOnly&&activeOnly.rows)||[];

     if(activeRows.length){
       box.innerHTML=`<div class="passport-title product-title-actions"><div class="passport-main-copy"><span>ACTIVE PRODUCT INTELLIGENCE</span><h2>${esc(raw)}</h2><p>\u0424\u0430\u043e\u043b \u043b\u043e\u0442\u043b\u0430\u0440\u0434\u0430 \u043c\u0430\u0432\u0436\u0443\u0434.</p></div></div><section class="bi-card recent-card active-product-card" id="fastActiveLots"><div class="loading">Active lots...</div></section>`;
       await loadFastActiveLots(raw);
       return;
     }

     box.innerHTML=`<div class="empty-state"><div>?</div><h3>\u0422\u043e\u0432\u0430\u0440 \u0442\u043e\u043f\u0438\u043b\u043c\u0430\u0434\u0438</h3><p>${esc(raw)}</p></div>`;
     return;
   }
   const norm=s=>fixText(s).toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
   const rn=norm(raw);
   const chosen=matches.find(x=>norm(x.display_name)===rn)||matches.find(x=>norm(x.display_name).startsWith(rn))||matches[0];
   if($("#paQ"))$("#paQ").value=fixText(chosen.display_name);
   $("#paSuggest") && ($("#paSuggest").innerHTML="");
   box.innerHTML=`<div class="loading">“${esc(chosen.display_name)}” аналитикаси юкланмоқда…</div>`;

   // 2) analytics from pre-built cache; do NOT wait for pending lots
   const d=await get(`/api/product-fast/${chosen.product_id}?recent_days=30&recent_limit=500`);
   const s=d.summary||{}, months=["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
   const season=d.seasonality||[], monthly=d.monthly||[], recent=d.recent||[], active=d.platforms||[], recentSummary=d.recent_summary||{}, recentBreakdown=recentSummary.breakdown||[];
   const maxSeason=Math.max(1,...season.map(x=>Number(x.deals||0)));
   const maxTrend=Math.max(1,...monthly.map(x=>Number(x.unit_price||0)));

   box.innerHTML=`
    <div class="passport-title product-title-actions">
      <div class="passport-main-copy"><span>PRODUCT INTELLIGENCE</span><h2>${esc(d.query)}</h2><p>Тезкор canonical BI cache • ${num(s.deals||0)} та тарихий савдо</p>${productCodeBadges(d.codes)}<a href="https://yandex.ru/images/search?text=${encodeURIComponent(d.query)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:8px 12px;border:1px solid #d9e2ea;border-radius:10px;background:#fff;color:#0f2747;text-decoration:none;font-size:13px;font-weight:700;box-shadow:0 1px 2px rgba(15,23,42,.04)">🖼️ Yandex Images’да кўриш ↗</a></div>
      <div class="product-quick-area">
        <div class="product-quick-tabs" role="tablist" aria-label="Товар бўйича тезкор бўлимлар">
          <button type="button" class="product-quick-tab recent" data-product-view="recent" aria-expanded="false"><span class="product-quick-icon">▣</span><span><b>Сўнгги 30 кун</b><small>${num(recentSummary.count||recent.length)} та савдо</small></span></button>
          <button type="button" class="product-quick-tab active" data-product-view="active" aria-expanded="false"><span class="product-quick-icon">&#9635;</span><span><b>\u0424\u0430\u043e\u043b \u0445\u0430\u0440\u0438\u0434\u043b\u0430\u0440</b><small>\u044e\u043a\u043b\u0430\u043d\u043c\u043e\u049b\u0434\u0430\u2026</small></span></button>
          <button type="button" class="product-quick-tab supply" data-product-view="supply" aria-expanded="false"><span class="product-quick-icon">&#9636;</span><span><b>\u0424\u0430\u043e\u043b \u0442\u0430\u043a\u043b\u0438\u0444\u043b\u0430\u0440</b><small data-product-supply-count>\u044e\u043a\u043b\u0430\u043d\u043c\u043e\u049b\u0434\u0430\u2026</small></span></button>
        </div>
        <div class="passport-badge">REAL DATA</div>
      </div>
    </div>
    <div class="product-source-overview">
      <div><small>ДАВР (МАЪЛУМОТ ҚАМРОВИ)</small><b>${esc(String(s.first_date||"—").slice(0,10))} — ${esc(String(s.last_date||"—").slice(0,10))}</b><span>${num(s.deals||0)} та битим</span></div>
      <div class="product-source-platforms"><small>ИНОБАТГА ОЛИНГАН САВДО ТУРЛАРИ</small><section>${active.map(x=>`<span>${brandLogo(x.key,x,"mini-platform-logo")}<b>${esc(cleanPlatformName({platform_key:x.key,platform:x.title}))}</b><em>${num(x.count)} та</em></span>`).join("")||"—"}</section></div>
      <div><small>bidata BUSINESS INTELLIGENCE PLATFORM</small><b>Маълумот манбалари</b><span>${[...new Set(active.map(x=>x.source).filter(Boolean))].map(esc).join(" • ")||"—"}</span></div>
    </div>
    ${renderProductConclusion(d)}
    <div class="passport-kpis">
      <div><small>САВДОЛАР</small><b>${num(s.deals||0)}</b><em>та битим</em></div>
      <div><small>САВДО ҲАЖМИ</small><b>${money(s.amount||0)}</b><em>жами қиймат</em></div>
      <div><small>ЎРТАЧА БИРЛИК НАРХИ</small><b>${s.unit_avg!=null?money(s.unit_avg):"—"}</b><em>бир бирлик</em></div>
      <div><small>МЕДИАНА НАРХ</small><b>${s.unit_median!=null?money(s.unit_median):"—"}</b><em>бир бирлик</em></div>
      <div><small>МИНИМАЛ НАРХ</small><b>${s.unit_min!=null?money(s.unit_min):"—"}</b><em>бир бирлик</em></div>
      <div><small>МАКСИМАЛ НАРХ</small><b>${s.unit_max!=null?money(s.unit_max):"—"}</b><em>бир бирлик</em></div>
    </div>
    <div class="passport-grid">
      <section class="bi-card"><div class="bi-card-head"><div><span>НАРХ ДИНАМИКАСИ</span><h3>Ойлик ўртача бирлик нархи</h3></div><small>охирги 24 ой</small></div>
        <div class="trend-bars">${monthly.length?monthly.map(x=>`<div class="trend-col" title="${esc(x.ym)} • ${x.unit_price!=null?money(x.unit_price):'—'}"><i style="height:${x.unit_price?Math.max(4,Math.round(x.unit_price/maxTrend*100)):2}%"></i><small>${esc(String(x.ym||'').slice(2))}</small></div>`).join(""):'<div class="no-data">Нарх динамикаси учун маълумот йўқ</div>'}</div>
      </section>
      <section class="bi-card"><div class="bi-card-head"><div><span>МАВСУМИЙЛИК</span><h3>12 ойлик савдо фаоллиги</h3></div><small>савдолар сони</small></div>
        <div class="season-list">${season.map(x=>`<div><span>${months[x.month-1]}</span><i><b style="width:${Math.round((x.deals||0)/maxSeason*100)}%"></b></i><strong>${num(x.deals||0)}</strong></div>`).join("")}</div>
      </section>
    </div>
    <section class="bi-card platform-breakdown"><div class="bi-card-head"><div><span>ПЛАТФОРМАЛАР КЕСИМИ</span><h3>Товар қаерда ва қанча сотилган</h3></div></div>
      <div class="platform-strip">${active.map(x=>`<div>${brandLogo(x.key,x,"platform-strip-logo")}<section><b>${esc(cleanPlatformName({platform_key:x.key,platform:x.title}))}</b><small>Манба: ${esc(x.source||"—")} • ${num(x.count)} савдо • ${money(x.amount||0)}</small></section><strong>${x.unit_price?.avg!=null?money(x.unit_price.avg):"—"}<small> ўрт. бирлик</small></strong></div>`).join("")}</div>
    </section>
    <section class="bi-card recent-card recent-history-zone hidden" id="productRecent30">
      <div class="bi-card-head">
        <div><span>СЎНГГИ 30 КУН</span><h3>Ушбу товар бўйича охирги савдолар</h3></div>
        <small>${num(recentSummary.count||recent.length)} та савдо • ${money(recentSummary.amount||0)}</small>
      </div>

      ${recentBreakdown.length?`<div class="recent-source-stats" id="recentSourceStats">
        <article class="recent-source-stat tone-all active-filter" data-recent-filter="all" role="button" tabindex="0">
          <div class="recent-source-stat-head">
            <div class="recent-source-all-ico">ALL</div>
            <div><b>Барчаси</b><span>Барча савдо турлари</span></div>
          </div>
          <div class="recent-source-stat-metrics">
            <div><strong>${num(recentSummary.count||0)}</strong><small>лотлар сони</small></div>
            <div><strong>${money(recentSummary.amount||0)}</strong><small>савдо суммаси</small></div>
          </div>
        </article>
        ${recentBreakdown.map((x,idx)=>`<article class="recent-source-stat tone-${(idx%5)+1}" data-recent-filter="${esc(x.key)}" role="button" tabindex="0">
          <div class="recent-source-stat-head">
            ${brandLogo(x.key,x,"recent-source-stat-logo")}
            <div><b>${esc(x.source||x.title||x.key||"—")}</b><span>${esc((PLATFORM_BRAND[x.key]?.trade)||"Савдо тури")}</span></div>
          </div>
          <div class="recent-source-stat-metrics">
            <div><strong>${num(x.count||0)}</strong><small>лотлар сони</small></div>
            <div><strong>${money(x.amount||0)}</strong><small>савдо суммаси</small></div>
          </div>
        </article>`).join("")}
      </div>`:""}

      <div class="recent-list-head">
        <div><span>САВДОЛАР РЎЙХАТИ</span><small>${esc(String(recentSummary.date_from||"").slice(0,10))} — ${esc(String(recentSummary.date_to||"").slice(0,10))}</small></div>
        <div><b>${num(recentSummary.count||recent.length)}</b> та лот • <b>${money(recentSummary.amount||0)}</b></div>
      </div>

      <div class="recent-deal-grid" id="recentDealGrid">${recent.length?recent.map((r,i)=>`<div class="recent-filter-wrap" data-recent-key="${esc(r.platform_key||"")}">${recentDealCard(r,i)}</div>`).join(""):`<div class="recent-deal-empty">Сўнгги 30 кун ичида савдо топилмади</div>`}</div>
    </section>
    <section class="bi-card recent-card active-product-card hidden" id="fastActiveLots">
      <div class="bi-card-head"><div><span>ФАОЛ ЛОТЛАР</span><h3>“${esc(d.query)}” бўйича фаол/кутилаётган лотлар</h3></div><small>юкланмоқда…</small></div>
      <div class="loading">Фаол лотлар алоҳида қидирилмоқда. Асосий аналитика бу жараённи кутмайди.</div>
    </section>`;

   // Recent sales: clickable card UI; active lots remain unchanged.
   __uzbiRecentDeals=recent;
   ensureRecentDealCardStyles();
   bindRecentDealCards();
   __recentFilterKey="all";
   bindRecentSourceFilters(recent, recentSummary);

   // 3) Recent sales and active lots are opened only from the premium quick-view buttons.
   bindProductQuickViews(fixText(d.query));
    bindConclusionActiveButton();
    hydrateProductConclusion(d);
 }catch(e){
   box.innerHTML=`<div class="notice error"><b>Товар аналитикасида хато</b><br>${esc(e.message)}</div>`;
 }
}

function bindProductQuickViews(q){
  const buttons=[...document.querySelectorAll('[data-product-view]')];
  const recentSection=document.getElementById('productRecent30');
  const activeSection=document.getElementById('fastActiveLots');
  if(!buttons.length)return;
  let activeLoaded=false;

  const closeAll=()=>{
    recentSection?.classList.add('hidden');
    activeSection?.classList.add('hidden');
    buttons.forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-expanded','false');});
  };

  const openView=async(view,button)=>{
    const section=view==='recent'?recentSection:activeSection;
    const wasOpen=button.classList.contains('is-selected') && section && !section.classList.contains('hidden');

    closeAll();
    if(wasOpen)return;

    section?.classList.remove('hidden');
    button.classList.add('is-selected');
    button.setAttribute('aria-expanded','true');

    if((view==='active' || view==='supply') && !activeLoaded){
      activeLoaded=true;
      await loadFastActiveLots(q);
    }

    let target=section;

    if(view==='active'){
      target=document.getElementById('activeDemandView') || activeSection;
    }else if(view==='supply'){
      target=activeSection?.querySelector('.active-supply-zone') || activeSection;
    }

    requestAnimationFrame(()=>target?.scrollIntoView({behavior:'smooth',block:'start'}));
  };

  buttons.forEach(button=>{
    button.onclick=()=>openView(button.dataset.productView,button);
  });
}

function bindRecentSourceFilters(recent, recentSummary){
  const cards=[...document.querySelectorAll('[data-recent-filter]')];
  if(!cards.length)return;
  const apply=(key)=>{
    __recentFilterKey=key||"all";
    cards.forEach(c=>c.classList.toggle("active-filter",c.dataset.recentFilter===__recentFilterKey));
    let visible=0, amount=0;
    document.querySelectorAll("[data-recent-key]").forEach(w=>{
      const row=recent[Number(w.querySelector("[data-recent-deal-index]")?.dataset.recentDealIndex)]||null;
      const show=__recentFilterKey==="all" || w.dataset.recentKey===__recentFilterKey;
      w.classList.toggle("filter-hidden",!show);
      if(show&&row){visible++;amount+=Number(row.total_value||0);}
    });
    const info=document.querySelector(".recent-list-head>div:last-child");
    if(info){
      if(__recentFilterKey==="all"){
        info.innerHTML=`<b>${num(recentSummary.count||recent.length)}</b> та лот • <b>${money(recentSummary.amount||0)}</b>`;
      }else{
        const stat=(recentSummary.breakdown||[]).find(x=>String(x.key)===__recentFilterKey);
        info.innerHTML=`<b>${num(stat?.count||visible)}</b> та лот • <b>${money(stat?.amount||amount)}</b>`;
      }
    }
  };
  cards.forEach(c=>{
    const go=()=>apply(c.dataset.recentFilter||"all");
    c.onclick=go;
    c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};
  });
  apply("all");
}

function activeLotDeadline(deadline){
 const raw=String(deadline||'').trim();
 if(!raw)return {label:'Муддат —',cls:''};
 const dt=new Date(raw.replace(' ','T'));
 if(Number.isNaN(dt.getTime()))return {label:raw.slice(0,16),cls:''};
 const now=new Date();
 const ms=dt-now;
 const hours=Math.ceil(ms/3600000);
 const days=Math.ceil(ms/86400000);
 if(ms<0)return {label:'Муддати ўтган',cls:'expired'};
 if(hours<=24)return {label:hours<=1?'1 соатдан кам':'Бугун • '+hours+' соат',cls:'today'};
 if(days<=3)return {label:days+' кун қолди',cls:'soon'};
 return {label:days+' кун қолди',cls:''};
}
function activeLotCard(r,i){
 const isSupply=['shop','national','xt_national'].includes(String(r.platform_key||''));
 const dl=activeLotDeadline(r.deadline);
 const lot=esc(r.lot_no||r.id||'—');
 const product=esc(r.product||r.name||'—');
 const region=esc(r.region||'—');
 const status=esc(r.status||'Фаол');
 const qty=r.quantity!=null?`${num(r.quantity)} ${esc(r.unit_name||r.unit||'')}`.trim():'';
 const unitPrice=r.unit_price!=null?`${money(r.unit_price)} / бирлик`:'';
 const preview=esc(r.description||r.condition||r.preview||r.category||(isSupply?'Фаол сотув таклифи. Батафсил маълумот учун карточкани босинг.':'Фаол харид лоти. Батафсил маълумот учун карточкани босинг.'));
 const tags=[region,qty,unitPrice||status].filter(x=>x&&x!=='—');
 return `<article class="active-lot-card" role="button" tabindex="0" data-active-lot-index="${i}">
  <div class="active-lot-top"><div class="active-lot-badges"><span class="active-lot-badge platform branded-badge">${brandLogo(r.platform_key,null,"badge-platform-logo")}${esc(cleanPlatformName(r))}</span><span class="active-lot-badge">Лот № ${lot}</span></div><span class="active-lot-deadline ${dl.cls}">${esc(dl.label)}</span></div>
  <h4 class="active-lot-title">${product}</h4>
  <div class="active-lot-preview">${preview}</div>
  <div class="active-lot-tags">${tags.map(x=>`<span class="active-lot-tag">${x}</span>`).join('')}</div>
  <div class="active-lot-foot"><div class="active-lot-meta"><div>${isSupply?'Таклиф миқдори: '+(qty||'—'):'Буюртмачи: '+esc(r.customer||'—')}</div><div>Якунланиши: ${esc(String(r.deadline||'—').slice(0,16))}</div></div><div class="active-lot-price"><strong>${r.amount!=null?money(r.amount):'—'}</strong><small>${isSupply?'таклиф қиймати':'бошланғич қиймат'}</small></div></div>
 </article>`;
}
function bindActiveLotCards(rows,root=document){
 root.querySelectorAll('[data-active-lot-index]').forEach(el=>{
  const open=()=>openActiveLotModal(rows[Number(el.dataset.activeLotIndex)]);
  el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
 });
}
async function openActiveLotModal(r){
 if(!r)return;

 document.getElementById('uzbiActiveLotModal')?.remove();

 const modal=document.createElement('div');
 modal.id='uzbiActiveLotModal';
 modal.className='uzbi-deal-modal';

 modal.innerHTML=`<div class="uzbi-deal-modal-card">
   <div class="uzbi-deal-modal-head">
     <div>
       <span>${esc(cleanPlatformName(r))}</span>
       <h3>${esc(r.product||r.name||'\u041b\u043e\u0442 \u043c\u0430\u044a\u043b\u0443\u043c\u043e\u0442\u0438')}</h3>
     </div>
     <button class="uzbi-deal-modal-close" type="button">&times;</button>
   </div>
   <div class="loading">\u041b\u043e\u0442 \u043c\u0430\u044a\u043b\u0443\u043c\u043e\u0442\u043b\u0430\u0440\u0438 \u044e\u043a\u043b\u0430\u043d\u043c\u043e\u049b\u0434\u0430...</div>
 </div>`;

 document.body.appendChild(modal);

 const close=()=>modal.remove();
 modal.querySelector('.uzbi-deal-modal-close').onclick=close;
 modal.onclick=e=>{if(e.target===modal)close()};

 try{
   const key=r.platform_key||'';
   const id=String(r.id||'');

   const d=key&&id
     ? await get(`/api/pending/${encodeURIComponent(key)}/detail/${encodeURIComponent(id)}`)
     : null;

   const rec=d?.record||r;
   const extras=d?.extras||{};

   const row=(label,value,full=false)=>{
     if(value==null || value==='')return '';
     return `<div class="uzbi-deal-detail${full?' full':''}">
       <small>${esc(label)}</small>
       <b>${esc(String(value))}</b>
     </div>`;
   };

   if(key==='shop'||key==='national'){
     const offerId=rec.offer_id || r.id || '';
     const lotNo=rec.display_no || r.lot_no || offerId || '-';
     const product=rec.product_name || r.product || r.name || '\u0422\u043e\u0432\u0430\u0440';
     const productCode=r.product_code || rec.product_code || '';
     const quantity=rec.amount ?? r.quantity ?? null;
     const unit=rec.unit_name || r.unit_name || '';
     const unitPrice=rec.price ?? r.unit_price ?? null;
     const totalValue=rec.total_value ?? r.amount ?? (
       quantity!=null && unitPrice!=null ? Number(quantity)*Number(unitPrice) : null
     );
     const category=rec.category_name || r.category || '';
     const status=rec.status_name || r.status || '';
     const deadline=rec.date_end || r.deadline || '';
     const brand=rec.mark_name || '';
     const manufacturer=rec.manufacturer_name || '';
     const description=
       rec.product_description ||
       rec.condition_text ||
       rec.description ||
       '';
     const specification=rec.specification_text || '';

     const rawDetail=_parseMaybeJson(rec.detail_raw_json);
     const rawProps=
       _parseMaybeJson(rec.js_properties) ||
       (rawDetail && typeof rawDetail==='object' ? (rawDetail.js_properties || rawDetail.properties) : null);

     const flattenProps=(x)=>{
       const out=[];
       const walk=(v)=>{
         if(v==null)return;
         if(Array.isArray(v)){v.forEach(walk);return;}
         if(typeof v!=='object')return;
         const name=v.property_name ?? v.name ?? v.title ?? v.label ?? v.key;
         const value=v.property_value ?? v.value ?? v.val ?? v.text ?? v.description;
         if(name!=null && value!=null && String(value).trim()){
           out.push([String(name).trim(),String(value).trim()]);
         }
         Object.values(v).forEach(z=>{if(z && typeof z==='object')walk(z)});
       };
       walk(x);
       const seen=new Set();
       return out.filter(([a,b])=>{
         const k=(a+'|'+b).toLocaleLowerCase('ru-RU');
         if(seen.has(k))return false;
         seen.add(k);
         return true;
       }).slice(0,60);
     };

     const propPairs=flattenProps(rawProps);
     const propHtml=propPairs.length
       ? `<div class="shop-props-block">
            <h4 class="shop-section-title">${shopIcon('category')}<span>\u0422\u043e\u0432\u0430\u0440 \u0445\u0443\u0441\u0443\u0441\u0438\u044f\u0442\u043b\u0430\u0440\u0438</span></h4>
            <div class="shop-props-grid">
              ${propPairs.map(([a,b])=>`<div><small>${esc(a)}</small><b>${esc(b)}</b></div>`).join('')}
            </div>
          </div>`
       : (specification
          ? `<div class="shop-text-block"><h4>\u0422\u043e\u0432\u0430\u0440 \u0445\u0443\u0441\u0443\u0441\u0438\u044f\u0442\u043b\u0430\u0440\u0438</h4><p>${esc(specification)}</p></div>`
          : '');

     const sourceUrl=
       rec.source_url ||
       (offerId ? `https://xarid.uzex.uz/shop/product-details/${encodeURIComponent(offerId)}?type=0` : '');

     // SHOP_ICON_PATCH_V2
     const shopUzs=(v)=>{
       if(v==null || v==='' || !Number.isFinite(Number(v)))return '-';
       return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v));
     };
     const shopIcon=(name)=>{
       const common='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
       const p={
         lot:`<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>`,
         calendar:`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>`,
         code:`<path d="M5 4v16M9 4v16M13 4v16M18 4v16M21 4v16"/>`,
         qty:`<path d="M5 7l7-4 7 4-7 4z"/><path d="M5 7v10l7 4 7-4V7M12 11v10"/>`,
         unit:`<path d="M4 18L18 4l2 2L6 20z"/><path d="M12 10l2 2M9 13l2 2M15 7l2 2"/>`,
         price:`<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v5c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 10v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>`,
         total:`<path d="M3 7h18v12H3z"/><path d="M7 7V5h10v2"/><circle cx="12" cy="13" r="2"/>`,
         category:`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
         status:`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>`,
         tag:`<path d="M3 12l9-9h7l2 2v7l-9 9z"/><circle cx="16" cy="8" r="1"/>`,
         factory:`<path d="M3 21V9l6 3V8l6 4V5h6v16z"/><path d="M7 17h2M12 17h2M17 17h2"/>`,

    region:`<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="9" r="2"/>`,

    address:`<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>`,

    inn:`<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16c.8-1.7 4.2-1.7 5 0M13 10h5M13 14h5"/>`,
         text:`<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h6"/>`
       };
       return `<svg ${common}>${p[name]||p.text}</svg>`;
     };

     modal.innerHTML=`<div class="uzbi-deal-modal-card shop-active-modal-card">
       <div class="uzbi-deal-modal-head">
         <div>
           <span>${esc(cleanPlatformName(r))}</span>
           <h3>${esc(product)}</h3>
         </div>
         <button class="uzbi-deal-modal-close" type="button">&times;</button>
       </div>

       <div class="shop-active-summary">
         <div class="shop-active-top-row">
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('lot')}<span>\u041b\u043e\u0442 \u0440\u0430\u049b\u0430\u043c\u0438</span></small><b>${esc(String(lotNo))}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('calendar')}<span>\u042f\u043a\u0443\u043d\u043b\u0430\u043d\u0438\u0448 \u0441\u0430\u043d\u0430\u0441\u0438</span></small><b>${esc(String(deadline||'-').slice(0,10))}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('code')}<span>\u0422\u043e\u0432\u0430\u0440 \u043a\u043e\u0434\u0438</span></small><b>${esc(productCode||'-')}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('qty')}<span>\u0421\u043e\u043d\u0438</span></small><b>${quantity!=null?num(quantity):'-'}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('unit')}<span>\u040e\u043b\u0447\u043e\u0432 \u0431\u0438\u0440\u043b\u0438\u0433\u0438</span></small><b>${esc(unit||'-')}</b></div>
           <div class="shop-active-cell price"><small class="shop-cell-title">${shopIcon('price')}<span>\u0411\u0438\u0440\u043b\u0438\u043a \u043d\u0430\u0440\u0445\u0438</span></small><b>${shopUzs(unitPrice)}</b></div>
           <div class="shop-active-cell total"><small class="shop-cell-title">${shopIcon('total')}<span>\u0416\u0430\u043c\u0438 \u049b\u0438\u0439\u043c\u0430\u0442</span></small><b>${shopUzs(totalValue)}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('category')}<span>\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f</span></small><b>${esc(category||'-')}</b></div>
           <div class="shop-active-cell"><small class="shop-cell-title">${shopIcon('status')}<span>\u0411\u0438\u0442\u0438\u043c \u04b3\u043e\u043b\u0430\u0442\u0438</span></small><b>${esc(status||'-')}</b></div>
         </div>

         ${(brand||manufacturer)?`
         <div class="shop-info-grid">
           ${brand?`<div><small class="shop-info-title">${shopIcon('tag')}<span>\u041c\u0430\u0440\u043a\u0430</span></small><b>${esc(brand)}</b></div>`:''}
           ${manufacturer?`<div><small class="shop-info-title">${shopIcon('factory')}<span>\u0418\u0448\u043b\u0430\u0431 \u0447\u0438\u049b\u0430\u0440\u0443\u0432\u0447\u0438</span></small><b>${esc(manufacturer)}</b></div>`:''}
         </div>`:''}

         ${description?`<div class="shop-text-block"><h4 class="shop-section-title">${shopIcon('text')}<span>\u0422\u043e\u0432\u0430\u0440 \u0442\u0430\u0432\u0441\u0438\u0444\u0438</span></h4><p>${esc(description)}</p></div>`:''}
         ${propHtml}

         ${sourceUrl?`
         <div class="shop-source-link-wrap">
           <a class="shop-source-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">
             \u041c\u0430\u043d\u0431\u0430\u0434\u0430 \u043a\u045e\u0440\u0438\u0448
           </a>
         </div>`:''}
       </div>
     </div>`;

     modal.querySelector('.uzbi-deal-modal-close').onclick=close;
     return;
   }

   if(key==='xt_national'){

     const product=
       rec.product_name ||
       rec.name ||
       r.product ||
       '\u0422\u043e\u0432\u0430\u0440';

     const procId=rec.proc_id || r.id || '-';

     const productCode=
       rec.product_id ||
       rec.product_code ||
       '';

     const categoryCode=
       rec.category_code ||
       '';

     const category=
       rec.category_name ||
       '';

     const quantity=rec.amount;
     const unit=rec.unit || '';
     const unitPrice=rec.price;
     const totalValue=rec.totalcost;

     const qtyText=
       quantity!=null
         ? `${num(quantity)}${unit?' '+unit:''}`
         : '-';

     const statusRaw=String(rec.status||'').trim();

     const statusMap={
       publicated:'\u042d\u044a\u043b\u043e\u043d \u049b\u0438\u043b\u0438\u043d\u0433\u0430\u043d',
       published:'\u042d\u044a\u043b\u043e\u043d \u049b\u0438\u043b\u0438\u043d\u0433\u0430\u043d',
       active:'\u0424\u0430\u043e\u043b',
       open:'\u0424\u0430\u043e\u043b'
     };

     const status=
       statusMap[statusRaw.toLowerCase()] ||
       statusRaw ||
       '\u0424\u0430\u043e\u043b';

     const date=
       rec.publicated_at ||
       rec.first_seen_at ||
       '';

     const deadline=rec.close_at || '';

     const dl=activeLotDeadline(deadline);
      const details=(extras.product_details && typeof extras.product_details==='object')
        ? extras.product_details
        : {};

      const brand=details.brand || rec.brand || '';
      const manufacturer=details.manufacturer || rec.manufacturer || '';
      const description=details.description || rec.description || '';

      const props=Array.isArray(details.properties) && details.properties.length
        ? details.properties
        : (Array.isArray(extras.properties) ? extras.properties : []);

     const propRows=props.map(x=>{
       const name=
         x.prop_name ||
         x.property_name ||
         x.name ||
         '';

       const value=
         x.value_name ??
         x.prop_value ??
         x.property_value ??
         x.val_numb ??
         x.prop_numb ??
         x.value ??
         '';

       if(!name || value==null || value==='')return '';

       return `<div class="uzbi-deal-prop-item">
         <small>${esc(String(name))}</small>
         <b>${esc(String(value))}</b>
       </div>`;
     }).join('');

     const propHtml=propRows
       ? `<div class="uzbi-deal-properties">
           <h4>\u0422\u043e\u0432\u0430\u0440 \u0445\u0443\u0441\u0443\u0441\u0438\u044f\u0442\u043b\u0430\u0440\u0438</h4>
           <div class="uzbi-deal-prop-list">
             ${propRows}
           </div>
         </div>`
       : '';

     const regionRows=Array.isArray(extras.regions)
       ? extras.regions
       : [];

     const regionPath=Array.isArray(extras.region_path)
       ? extras.region_path
       : [];

     const topRegion=regionPath.find(x=>{
       const id=String(x.area_id||'');
       return /^33\.[^.]+$/.test(id);
     });

     const uzRegionNames={
       '33.34':'\u0410\u043d\u0434\u0438\u0436\u043e\u043d \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.274':'\u0411\u0443\u0445\u043e\u0440\u043e \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.519':'\u0416\u0438\u0437\u0437\u0430\u0445 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.711':'\u049a\u0430\u0448\u049b\u0430\u0434\u0430\u0440\u0451 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.1040':'\u041d\u0430\u0432\u043e\u0438\u0439 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.1182':'\u041d\u0430\u043c\u0430\u043d\u0433\u0430\u043d \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.1445':'\u0421\u0430\u043c\u0430\u0440\u049b\u0430\u043d\u0434 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.1724':'\u0421\u0443\u0440\u0445\u043e\u043d\u0434\u0430\u0440\u0451 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.2009':'\u0421\u0438\u0440\u0434\u0430\u0440\u0451 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.2137':'\u0422\u043e\u0448\u043a\u0435\u043d\u0442 \u0448\u0430\u04b3\u0440\u0438',
       '33.2152':'\u0422\u043e\u0448\u043a\u0435\u043d\u0442 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.2466':'\u0424\u0430\u0440\u0493\u043e\u043d\u0430 \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.2890':'\u0425\u043e\u0440\u0430\u0437\u043c \u0432\u0438\u043b\u043e\u044f\u0442\u0438',
       '33.3081':'\u049a\u043e\u0440\u0430\u049b\u0430\u043b\u043f\u043e\u0493\u0438\u0441\u0442\u043e\u043d \u0420\u0435\u0441\u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0441\u0438'
     };

     const topRegionCode=String(topRegion?.area_id||'');

     const region=
       uzRegionNames[topRegionCode] ||
       topRegion?.area_name ||
       extras.region_name ||
       rec.last_region_seen ||
       rec.owner_legal_area_id ||
       regionRows?.[0]?.area_id ||
       '';

     modal.querySelector('.uzbi-deal-modal-card').innerHTML=`
       <div class="auction-products-active" style="display:none"></div>

       <div class="uzbi-deal-modal-head">
         <div>
           <span>xt-xarid.uz \u2014 \u041c\u0438\u043b\u043b\u0438\u0439 \u0434\u045e\u043a\u043e\u043d \u0444\u0430\u043e\u043b \u043b\u043e\u0442</span>
           <h3>${esc(product)}</h3>
         </div>
         <button class="uzbi-deal-modal-close" type="button">&times;</button>
       </div>

       <div class="active-auction-summary xt-national-summary">
         <div class="active-auction-top-row">

           <div class="active-auction-cell">
             <small>${bidataBlockIcon('lot')}\u041b\u043e\u0442 \u0440\u0430\u049b\u0430\u043c\u0438</small>
             <b>${esc(String(procId||'-'))}</b>
           </div>

           <div class="active-auction-cell">
             <small>${bidataBlockIcon('calendar')}\u042f\u043a\u0443\u043d\u043b\u0430\u043d\u0438\u0448 \u0441\u0430\u043d\u0430\u0441\u0438</small>
             <b>${deadline?esc(String(deadline).slice(0,10)):'-'}</b>
           </div>

           <div class="active-auction-cell">
             <small>${bidataBlockIcon('code')}\u0422\u043e\u0432\u0430\u0440 \u043a\u043e\u0434\u0438</small>
             <b>${esc(String(productCode||'-'))}</b>
           </div>

           <div class="active-auction-cell">
             <small>${bidataBlockIcon('qty')}\u0421\u043e\u043d\u0438</small>
             <b>${quantity!=null?num(quantity):'-'}</b>
           </div>

           <div class="active-auction-cell">
             <small>${bidataBlockIcon('unit')}\u040e\u043b\u0447\u043e\u0432 \u0431\u0438\u0440\u043b\u0438\u0433\u0438</small>
             <b>${esc(String(unit||'-'))}</b>
           </div>

           <div class="active-auction-cell active-auction-price">
             <small>${bidataBlockIcon('price')}\u0421\u0442\u0430\u0440\u0442 / \u043d\u0430\u0440\u0445 \u0431\u0438\u0440\u043b\u0438\u043a</small>
             <b>${unitPrice!=null?num(unitPrice):'-'}</b>
           </div>

           <div class="active-auction-cell active-auction-price">
             <small>${bidataBlockIcon('total')}\u0411\u043e\u0448\u043b\u0430\u043d\u0493\u0438\u0447 \u0436\u0430\u043c\u0438</small>
             <b>${totalValue!=null?num(totalValue):(quantity!=null&&unitPrice!=null?num(Number(quantity)*Number(unitPrice)):'-')}</b>
           </div>

           <div class="active-auction-cell active-auction-category">
             <small>${bidataBlockIcon('category')}\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f</small>
             <b>${esc(String(category||'-'))}</b>
           </div>

           <div class="active-auction-cell active-auction-status">
             <small>${bidataBlockIcon('status')}\u0411\u0438\u0442\u0438\u043c \u04b3\u043e\u043b\u0430\u0442\u0438</small>
             <b>${esc(String(status||'-'))}</b>
           </div>

         </div>

         ${brand?`<div class="uzbi-deal-detail full"><small>${bidataBlockIcon('tag')}\u041c\u0430\u0440\u043a\u0430</small><b>${esc(String(brand))}</b></div>`:''}
         ${manufacturer?`<div class="uzbi-deal-detail full"><small>${bidataBlockIcon('factory')}\u0418\u0448\u043b\u0430\u0431 \u0447\u0438\u049b\u0430\u0440\u0443\u0432\u0447\u0438</small><b>${esc(String(manufacturer))}</b></div>`:''}
         ${description?`<div class="uzbi-deal-detail full"><small>${bidataBlockIcon('text')}\u0422\u043e\u0432\u0430\u0440 \u0442\u0430\u0432\u0441\u0438\u0444\u0438</small><b>${esc(String(description))}</b></div>`:''}

         ${propHtml}

         <div style="display:flex;justify-content:flex-end;margin-top:18px">
           <a class="btn primary" href="https://xt-xarid.uz/nad/${encodeURIComponent(procId)}/core" target="_blank" rel="noopener noreferrer">\u041d\u0430\u0440\u0445 \u0441\u045e\u0440\u0430\u0448</a>
         </div>
       </div>`;

     modal.querySelector('.uzbi-deal-modal-close').onclick=close;
     return;
   }

   const entries=Object.entries(rec).filter(([k,v])=>
     v!=null &&
     v!=='' &&
     !String(k).toLowerCase().includes('json')
   );

   const labels={
     id:'ID',
     lot_no:'\u041b\u043e\u0442 \u0440\u0430\u049b\u0430\u043c\u0438',
     display_no:'\u041b\u043e\u0442 \u0440\u0430\u049b\u0430\u043c\u0438',
     name:'\u041d\u043e\u043c\u0438',
     product_name:'\u0422\u043e\u0432\u0430\u0440',
     category_name:'\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f',
     date:'\u042d\u044a\u043b\u043e\u043d \u0441\u0430\u043d\u0430\u0441\u0438',
     deadline:'\u042f\u043a\u0443\u043d\u043b\u0430\u043d\u0438\u0448\u0438',
     start_date:'\u0411\u043e\u0448\u043b\u0430\u043d\u0438\u0448\u0438',
     end_date:'\u042f\u043a\u0443\u043d\u043b\u0430\u043d\u0438\u0448\u0438',
     status:'\u04b2\u043e\u043b\u0430\u0442\u0438',
     customer:'\u0411\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438',
     customer_name:'\u0411\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438',
     region:'\u0420\u0435\u0433\u0438\u043e\u043d',
     region_name:'\u0420\u0435\u0433\u0438\u043e\u043d',
     amount:'\u0411\u043e\u0448\u043b\u0430\u043d\u0493\u0438\u0447 \u049b\u0438\u0439\u043c\u0430\u0442',
     start_price:'\u0411\u043e\u0448\u043b\u0430\u043d\u0493\u0438\u0447 \u049b\u0438\u0439\u043c\u0430\u0442',
     total_amount:'\u0423\u043c\u0443\u043c\u0438\u0439 \u0441\u0443\u043c\u043c\u0430',
     quantity:'\u041c\u0438\u049b\u0434\u043e\u0440',
     unit:'\u0411\u0438\u0440\u043b\u0438\u043a',
     unit_name:'\u0411\u0438\u0440\u043b\u0438\u043a'
   };

   const genericRow=(k,v)=>
     `<div class="uzbi-deal-detail">
       <small>${esc(labels[k]||k)}</small>
       <b>${esc(String(v))}</b>
     </div>`;

   if((key==='auction'||key==='xt_auction')){
     console.log("=== BIDATA ACTIVE AUCTION FIELD PROBE ===");
     console.log("LOT:", rec.lot_no||rec.display_no||rec.lot_number);
     console.log("REC:", rec);
     console.log("EXTRAS:", extras);
     console.log("PRODUCTS:", extras.products);
     console.log("FIRST PRODUCT:", Array.isArray(extras.products)?extras.products[0]:null);
   }

   /* BIData ACTIVE AUCTION ? exact searched product inside lot */
   const activeAuctionProducts =
     (key==='auction'||key==='xt_auction') && Array.isArray(extras.products)
       ? extras.products
       : [];

   const activeAuctionNorm = v =>
     String(v||'')
       .toLocaleLowerCase('ru-RU')
       .replace(/\u0451/g,'\u0435')
       .replace(/\s+/g,' ')
       .trim();

   const activeAuctionWanted =
     activeAuctionNorm(r.product || r.name || rec.product_name || '');

   let activeAuctionProduct = null;

   if(activeAuctionProducts.length){

     /* 1. exact lot-position match: critical when several products have the same name */
     const wantedProductNo = String(
       pickField(
         r,
         ["product_no","item_no","position_no","no","matched_product_no","matched_item_no"],
         ""
       )
     ).trim();

     const wantedProductId = String(
       pickField(
         r,
         ["product_id","item_id","matched_product_id","matched_item_id"],
         ""
       )
     ).trim();

     if(wantedProductNo){
       activeAuctionProduct = activeAuctionProducts.find((p,i) =>
         auctionProductNo(p,i) === wantedProductNo
       );
     }

     /* 2. exact product/item id */
     if(!activeAuctionProduct && wantedProductId){
       activeAuctionProduct = activeAuctionProducts.find(p => {
         const pid = String(
           pickField(p,["id","product_id","item_id"],"")
         ).trim();
         return pid && pid === wantedProductId;
       });
     }

     /* 3. exact product-name fallback */
     if(!activeAuctionProduct){
       activeAuctionProduct = activeAuctionProducts.find(p =>
         activeAuctionNorm(
           pickField(p,["product_name","name","title"],"")
         ) === activeAuctionWanted
       );
     }

     /* 4. partial name fallback */
     if(!activeAuctionProduct && activeAuctionWanted){
       activeAuctionProduct = activeAuctionProducts.find(p => {
         const n = activeAuctionNorm(
           pickField(p,["product_name","name","title"],"")
         );
         return n.includes(activeAuctionWanted) ||
                activeAuctionWanted.includes(n);
       });
     }
   }

   const activeAuctionProductCode = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["product_code","code","mxik_code","ikpu_code"],
         null
       )
     : null;

   const activeAuctionQty = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["quantity","amount","qty"],
         null
       )
     : null;

   const activeAuctionUnit = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["unit_name","unit","measure_name"],
         null
       )
     : null;

   const activeAuctionStartPrice = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["start_unit_price","start_price","initial_unit_price","initial_price","price"],
         null
       )
     : null;

   const activeAuctionCurrentPrice = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["current_unit_price","current_price","last_price","unit_price"],
         null
       )
     : null;

   const activeAuctionDescription = activeAuctionProduct
     ? pickField(
         activeAuctionProduct,
         ["description","product_description","condition","details"],
         null
       )
     : null;

   const auctionComposition=((key==='auction'||key==='xt_auction') && Array.isArray(extras.products) && extras.products.length)
     ? renderAuctionLotProducts(extras.products,extras.properties||[],"Ушбу фаол аукцион лотидаги барча товарлар","active")
     : "";

   const activeAuctionTop = (key==='auction'||key==='xt_auction') ? `
     <div class="active-auction-summary">

       <div class="active-auction-top-row">

         <div class="active-auction-cell">
           <small>${bidataBlockIcon('lot')}\u041b\u043e\u0442 \u0440\u0430\u049b\u0430\u043c\u0438</small>
           <b>${esc(String(rec.lot_no||rec.display_no||rec.lot_number||'?'))}</b>
         </div>

         <div class="active-auction-cell">
           <small>${bidataBlockIcon('calendar')}\u0421\u0430\u0432\u0434\u043e \u0441\u0430\u043d\u0430\u0441\u0438</small>
           <b>${esc(String(rec.date||rec.start_date||rec.created_at||'?').slice(0,10))}</b>
         </div>

         <div class="active-auction-cell">
           <small>${bidataBlockIcon('code')}\u0422\u043e\u0432\u0430\u0440 \u043a\u043e\u0434\u0438</small>
           <b>${activeAuctionProductCode!=null
  ?esc(String(activeAuctionProductCode))
  :'?'}</b>
         </div>

         <div class="active-auction-cell">
           <small>${bidataBlockIcon('qty')}\u0421\u043e\u043d\u0438</small>
           <b>${activeAuctionQty!=null
  ?num(activeAuctionQty)
  :'?'}</b>
         </div>

         <div class="active-auction-cell">
           <small>${bidataBlockIcon('unit')}\u040e\u043b\u0447\u043e\u0432 \u0431\u0438\u0440\u043b\u0438\u0433\u0438</small>
           <b>${activeAuctionUnit!=null
  ?esc(String(activeAuctionUnit))
  :'?'}</b>
         </div>

         <div class="active-auction-cell active-auction-price">
           <small>${bidataBlockIcon('price')}\u0421\u0442\u0430\u0440\u0442 / \u043d\u0430\u0440\u0445 \u0431\u0438\u0440\u043b\u0438\u043a</small>
           <b>${activeAuctionStartPrice!=null
  ?num(activeAuctionStartPrice)
  :'?'}</b>
         </div>

         <div class="active-auction-cell active-auction-price">
           <small>${bidataBlockIcon('total')}\u0411\u043e\u0448\u043b\u0430\u043d\u0493\u0438\u0447 \u0436\u0430\u043c\u0438</small>
           <b>${activeAuctionQty!=null && activeAuctionStartPrice!=null
  ?num(Number(activeAuctionQty)*Number(activeAuctionStartPrice))
  :'?'}</b>
         </div>

         <div class="active-auction-cell active-auction-category">
           <small>${bidataBlockIcon('category')}\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f</small>
           <b>${esc(String(rec.category_name||rec.category||'?'))}</b>
         </div>

         <div class="active-auction-cell active-auction-status">
           <small>${bidataBlockIcon('status')}\u0411\u0438\u0442\u0438\u043c \u04b3\u043e\u043b\u0430\u0442\u0438</small>
           <b>${esc(String(rec.status_name||rec.status||'?'))}</b>
         </div>

       </div>


       <div class="active-auction-party-row">

         <div class="active-auction-party-cell">
           <small>${bidataBlockIcon('factory')}\u0411\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438</small>
           <b>${esc(String(rec.customer_name||rec.customer||'?'))}</b>
         </div>

         <div class="active-auction-party-cell">
           <small>${bidataBlockIcon('region')}\u0420\u0435\u0433\u0438\u043e\u043d</small>
           <b>${esc(String(rec.region_name||rec.region||'?'))}</b>
         </div>

         <div class="active-auction-party-cell">
           <small>${bidataBlockIcon('address')}\u0410\u0434\u0440\u0435\u0441</small>
           <b>${esc(String(rec.delivery_address||rec.address||rec.customer_address||'?'))}</b>
         </div>

         <div class="active-auction-party-cell">
           <small>${bidataBlockIcon('inn')}\u0421\u0422\u0418\u0420</small>
           <b>${esc(String(rec.customer_inn||rec.inn||rec.tin||'?'))}</b>
         </div>

       </div>


       <div class="active-auction-description">
         <small>${bidataBlockIcon('text')}\u0422\u043e\u0432\u0430\u0440 \u0442\u0430\u0432\u0441\u0438\u0444\u0438</small>
         <div>${activeAuctionDescription!=null
  ?esc(String(activeAuctionDescription))
  :'?'}</div>
       </div>

     </div>
   ` : `
     <div class="uzbi-deal-detail-grid">
       ${entries.map(([k,v])=>genericRow(k,v)).join('')}
     </div>
   `;

   modal.querySelector('.uzbi-deal-modal-card').innerHTML=`
     <div class="uzbi-deal-modal-head">
       <div>
         <span>${esc(d?.title||r.platform||'\u0424\u0410\u041e\u041b \u041b\u041e\u0422')}</span>
         <h3>${esc(
           (key==='auction'||key==='xt_auction') && activeAuctionProduct
             ? pickField(activeAuctionProduct,["product_name","name","title"],r.product||'')
             : (
                 rec.name ||
                 rec.product_name ||
                 r.product ||
                 rec.category_name ||
                 '\u041b\u043e\u0442 \u043c\u0430\u044a\u043b\u0443\u043c\u043e\u0442\u0438'
               )
         )}</h3>
       </div>

       <button class="uzbi-deal-modal-close" type="button">&times;</button>
     </div>

     ${activeAuctionTop}
     ${auctionComposition}
     ${(key==='auction'||key==='xt_auction') ? `
       <div class="active-auction-trade-link-wrap">
         <a
           class="active-auction-trade-link"
           href="https://xarid.uzex.uz/auction/detail/${encodeURIComponent(rec.id || rec.lot_id || row_id)}"
           target="_blank"
           rel="noopener noreferrer"
         >
           &#128279; Савдода қатнашиш
         </a>
       </div>
     ` : ''}`;

   modal.querySelector('.uzbi-deal-modal-close').onclick=close;

 }catch(e){
   modal.querySelector('.uzbi-deal-modal-card').innerHTML=
     `<div class="notice error">${esc(e.message)}</div>`;
 }
}


function bindActiveSourceFilters(rows,data,root=document){
  const cards=[...root.querySelectorAll('[data-active-filter]')];
  if(!cards.length)return;
  const apply=(key)=>{
    __activeFilterKey=key||"all";
    cards.forEach(c=>c.classList.toggle("active-filter",c.dataset.activeFilter===__activeFilterKey));
    let visible=0,amount=0;
    root.querySelectorAll("[data-active-key]").forEach(w=>{
      const show=__activeFilterKey==="all" || w.dataset.activeKey===__activeFilterKey;
      w.classList.toggle("filter-hidden",!show);
      if(show){
        const btn=w.querySelector("[data-active-lot-index]");
        const r=btn?rows[Number(btn.dataset.activeLotIndex)]:null;
        if(r){visible++;amount+=Number(r.amount||0);}
      }
    });
    const info=root.querySelector(".active-list-head>div:last-child");
    if(info){
      if(__activeFilterKey==="all"){
        info.innerHTML=`<b>${num(data.count||rows.length)}</b> та лот • <b>${money(data.amount||0)}</b>`;
      }else{
        const stat=(data.breakdown||[]).find(x=>String(x.key)===__activeFilterKey);
        info.innerHTML=`<b>${num(stat?.count||visible)}</b> та лот • <b>${money(stat?.amount||amount)}</b>`;
      }
    }
  };
  cards.forEach(c=>{
    const go=()=>apply(c.dataset.activeFilter||"all");
    c.onclick=go;
    c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};
  });
  apply("all");
}

async function loadFastActiveLots(q){
 const section=$("#fastActiveLots"); if(!section)return;
 try{
   const d=await getActiveProductData(q);

   const demand=d.demand||{};
   const supply=d.supply||{};

   const demandRows=[...(demand.rows||[])];
   const supplyRows=[...(supply.rows||[])];

   const demandBreakdown=demand.breakdown||[];
   const supplyBreakdown=supply.breakdown||[];

   const demandCount=Number(demand.count||demandRows.length||0);
   const demandAmount=Number(demand.amount||0);

   const supplyCount=Number(supply.count||supplyRows.length||0);
   const supplyAmount=Number(supply.amount||0);

   const rows=[...demandRows,...supplyRows];
   const breakdown=[...demandBreakdown,...supplyBreakdown];

   const totalCount=demandCount+supplyCount;
   const totalAmount=demandAmount+supplyAmount;

   const sourceCards=`<article class="active-source-stat tone-all active-filter" data-active-filter="all" role="button" tabindex="0">
       <div class="active-source-stat-head">
         <div class="active-source-all-ico">ALL</div>
         <div><b>Барчаси</b><span>Барча савдо турлари</span></div>
       </div>
       <div class="active-source-stat-metrics">
         <div><strong>${num(demandCount)}</strong><small>савдолар сони</small></div>
         <div><strong>${money(demandAmount)}</strong><small>умумий сумма</small></div>
       </div>
     </article>` + demandBreakdown.map((x,idx)=>{
     const cls=`tone-${(idx%5)+1}`;
     return `<article class="active-source-stat ${cls}" data-active-filter="${esc(x.key)}" role="button" tabindex="0">
       <div class="active-source-stat-head">
         ${brandLogo(x.key,x,"active-source-stat-logo")}
         <div>
           <b>${esc(x.source||x.title||x.key||"—")}</b>
           <span>${esc(PLATFORM_BRAND[String(x.key||"")]?.trade||x.trade_type||x.title||"\u2014")}</span>
         </div>
       </div>
       <div class="active-source-stat-metrics">
         <div><strong>${num(x.count||0)}</strong><small>савдолар сони</small></div>
         <div><strong>${money(x.amount||0)}</strong><small>умумий сумма</small></div>
       </div>
     </article>`;
   }).join("");

   const renderLoadMore=()=>{
     const box=document.getElementById("activeLoadMoreWrap");
     if(!box)return;

     if(rows.length>=totalCount){
       box.innerHTML=`<small>${num(totalCount)} та фаол лотнинг барчаси кўрсатилди</small>`;
       return;
     }

     box.innerHTML=`
       <button type="button" class="btn ghost" id="activeLoadMore">
         Яна 50 та кўрсатиш
       </button>
       <small>${num(rows.length)} / ${num(totalCount)} та лот кўрсатилмоқда</small>`;

     const btn=document.getElementById("activeLoadMore");
     if(!btn)return;

     btn.onclick=async()=>{
       const oldText=btn.textContent;
       btn.disabled=true;
       btn.textContent="Юкланмоқда…";

       try{
         const next=await get(
           `/api/product-active-lots?q=${encodeURIComponent(q)}&limit=50&offset=${rows.length}`
         );
         const more=next.rows||[];

         if(!more.length){
           renderLoadMore();
           return;
         }

         const base=rows.length;
         rows.push(...more);

         const grid=document.getElementById("activeLotGrid");
         if(grid){
           grid.insertAdjacentHTML(
             "beforeend",
             more.map((r,i)=>`<div class="active-filter-wrap" data-active-key="${esc(r.platform_key||"")}">${activeLotCard(r,base+i)}</div>`).join("")
           );
         }

         bindActiveLotCards(demandRows);
         bindActiveSourceFilters(demandRows,demand);
         renderLoadMore();


       }catch(e){
         btn.disabled=false;
         btn.textContent=oldText;
         alert("Кейинги лотларни юклашда хато: "+e.message);
       }
     };
   };

   section.innerHTML=`
    <div id="activeDemandView">
    <div class="active-zone-head">
      <div class="active-zone-title">
        <span class="active-zone-signal">◉</span>
        <div><span>ФАОЛ ЛОТЛАР</span><h3>Ҳозир савдода турган “${esc(q)}” лотлари</h3></div>
      </div>
      <div class="active-zone-total"><b>${num(demandCount)}</b><span>та фаол лот</span></div>
    </div>

    ${demandBreakdown.length?`<div class="active-source-stats">${sourceCards}</div>`:""}

    <div class="active-list-head">
      <div><span>ЛОТЛАР РЎЙХАТИ</span><small>Фаол харидлар</small></div>
      <div><b>${num(demandCount)}</b> та лот • <b>${money(demandAmount)}</b></div>
    </div>

    <div class="active-lot-grid" id="activeLotGrid">${demandRows.length?demandRows.map((r,i)=>`<div class="active-filter-wrap" data-active-key="${esc(r.platform_key||"")}">${activeLotCard(r,i)}</div>`).join(''):`<div class="active-lot-empty">Ушбу аниқ товар бўйича ҳозир фаол лот топилмади</div>`}</div>

    <div id="activeLoadMoreWrap" style="display:flex;align-items:center;justify-content:center;gap:14px;padding:22px 0 6px;flex-wrap:wrap"></div>
    </div>`;

   ensureRecentDealCardStyles();
   bindActiveLotCards(demandRows);
   __activeFilterKey="all";
   bindActiveSourceFilters(demandRows,demand);
   const loadBox=document.getElementById("activeLoadMoreWrap");
   if(loadBox)loadBox.innerHTML=`<small>${num(demandCount)} та фаол хариднинг барчаси кўрсатилди</small>`;

   const supplyHtml=`
    <div class="active-supply-zone">
      <div class="active-zone-head">
        <div class="active-zone-title">
          <span class="active-zone-signal">&#9673;</span>
          <div><span>\u0424\u0410\u041e\u041b \u0422\u0410\u041a\u041b\u0418\u0424\u041b\u0410\u0420</span><h3>\u04b2\u043e\u0437\u0438\u0440 \u0441\u043e\u0442\u0443\u0432\u0434\u0430 \u0442\u0443\u0440\u0433\u0430\u043d \u201c${esc(q)}\u201d \u0442\u0430\u043a\u043b\u0438\u0444\u043b\u0430\u0440\u0438</h3></div>
        </div>
        <div class="active-zone-total"><b>${num(supplyCount)}</b><span>\u0442\u0430 \u0444\u0430\u043e\u043b \u0442\u0430\u043a\u043b\u0438\u0444</span></div>
      </div>

      ${supplyBreakdown.length?`<div class="active-source-stats">
        <article class="active-source-stat tone-all active-filter" data-active-filter="all" role="button" tabindex="0">
          <div class="active-source-stat-head">
            <div class="active-source-all-ico">ALL</div>
            <div><b>\u0411\u0430\u0440\u0447\u0430\u0441\u0438</b><span>\u0411\u0430\u0440\u0447\u0430 \u0442\u0430\u043a\u043b\u0438\u0444 \u0442\u0443\u0440\u043b\u0430\u0440\u0438</span></div>
          </div>
          <div class="active-source-stat-metrics">
            <div><strong>${num(supplyCount)}</strong><small>\u0442\u0430\u043a\u043b\u0438\u0444\u043b\u0430\u0440 \u0441\u043e\u043d\u0438</small></div>
            <div><strong>${money(supplyAmount)}</strong><small>\u0443\u043c\u0443\u043c\u0438\u0439 \u0441\u0443\u043c\u043c\u0430</small></div>
          </div>
        </article>
        ${supplyBreakdown.map((x,idx)=>{
        const cls=`tone-${(idx%5)+1}`;
        return `<article class="active-source-stat ${cls}" data-active-filter="${esc(x.key)}" role="button" tabindex="0">
          <div class="active-source-stat-head">
            ${brandLogo(x.key,x,"active-source-stat-logo")}
            <div>
              <b>${esc(x.source||x.title||x.key||"\u2014")}</b>
              <span>${esc(PLATFORM_BRAND[String(x.key||"")]?.trade||x.trade_type||x.title||"\u2014")}</span>
            </div>
          </div>
          <div class="active-source-stat-metrics">
            <div><strong>${num(x.count||0)}</strong><small>\u0442\u0430\u043a\u043b\u0438\u0444\u043b\u0430\u0440 \u0441\u043e\u043d\u0438</small></div>
            <div><strong>${money(x.amount||0)}</strong><small>\u0443\u043c\u0443\u043c\u0438\u0439 \u0441\u0443\u043c\u043c\u0430</small></div>
          </div>
        </article>`;
      }).join("")}</div>`:""}

      <div class="active-list-head">
        <div><span>\u0422\u0410\u041a\u041b\u0418\u0424\u041b\u0410\u0420 \u0420\u040e\u0419\u0425\u0410\u0422\u0418</span><small>\u0424\u0430\u043e\u043b \u0441\u043e\u0442\u0443\u0432 \u0442\u0430\u043a\u043b\u0438\u0444\u043b\u0430\u0440\u0438</small></div>
        <div><b>${num(supplyCount)}</b> \u0442\u0430 \u0442\u0430\u043a\u043b\u0438\u0444 \u2022 <b>${money(supplyAmount)}</b></div>
      </div>

      <div class="active-lot-grid active-supply-grid">
        ${supplyRows.length?supplyRows.map((r,i)=>`<div class="active-filter-wrap" data-active-key="${esc(r.platform_key||"")}">${activeLotCard(r,i)}</div>`).join(""):`<div class="active-lot-empty">\u0423\u0448\u0431\u0443 \u0430\u043d\u0438\u049b \u0442\u043e\u0432\u0430\u0440 \u0431\u045e\u0439\u0438\u0447\u0430 \u0444\u0430\u043e\u043b \u0442\u0430\u043a\u043b\u0438\u0444 \u0442\u043e\u043f\u0438\u043b\u043c\u0430\u0434\u0438</div>`}
      </div>

      <div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:22px 0 6px;flex-wrap:wrap">
        <small>${num(supplyCount)} \u0442\u0430 \u0444\u0430\u043e\u043b \u0442\u0430\u043a\u043b\u0438\u0444 \u043a\u045e\u0440\u0441\u0430\u0442\u0438\u043b\u0434\u0438</small>
      </div>
    </div>`;
   section.insertAdjacentHTML("beforeend",supplyHtml);
   const supplyZone=section.querySelector(".active-supply-zone");
   bindActiveLotCards(supplyRows,supplyZone);
   bindActiveSourceFilters(supplyRows,supply,supplyZone);

 }catch(e){
   section.innerHTML=`<div class="notice error"><b>Фаол лотлар қидирувида хато</b><br>${esc(e.message)}</div>`;
 }
}

async function showMarketAnalytics(){
 current="market_analytics";navActive("market_analytics");title.textContent="Бозор аналитикаси";
 setSourceContext("9 та савдо йўналиши • 5 та веб-манба");

 const marketMeta={
  auction:{
   metric:"Амалга ошган савдолар",
   features:"Товарлар • Нархлар • Буюртмачилар • Ғолиблар"
  },
  shop:{
   metric:"Амалга ошган савдолар",
   features:"Товарлар • Нархлар • Буюртмачилар • Етказиб берувчилар"
  },
  national:{
   metric:"Амалга ошган савдолар",
   features:"Товарлар • Нархлар • Буюртмачилар • Ҳудудлар"
  },
  xt_auction:{
   metric:"Муваффақиятли аукционлар",
   features:"Лотлар • Таклифлар • Нарх пасайиши • Ғолиблар"
  },
  xt_national:{
   metric:"Якунланган лотлар",
   features:"Товарлар • Нархлар • Буюртмачилар • Ҳудудлар"
  },
  etender:{
   metric:"Амалга ошган тендерлар",
   features:"Тендерлар • Суммалар • Буюртмачилар • Ғолиблар"
  },
  xt:{
   metric:"Якунланган тендерлар",
   features:"Тендерлар • Лотлар • Иштирокчилар • Натижалар"
  },
  shaffof:{
   metric:"Тасдиқланган шартномалар",
   features:"Тендерлар • Шартномалар • Буюртмачилар • Ғолиблар"
  },
  mc:{
   metric:"Ғолиби аниқланган тендерлар",
   features:"Тендерлар • Ғолиблар • Ҳудудлар • Буюртмачилар"
  }
 };

 app.innerHTML=`
 <section class="analytics-hero-mini market-intel-hero">
  <span>bidata MARKET INTELLIGENCE</span>
  <h2>Давлат харидлари бозори</h2>
  <p>9 та савдо йўналишини бир жойда таҳлил қилинг: бозор ҳажми, товарлар, нархлар, буюртмачилар ва ғолиблар.</p>
 </section>

 <div class="market-platform-list">
 ${platforms.map(p=>{
   const m=marketMeta[p.key]||{metric:"Маълумотлар",features:"Бозор • Таҳлил • Нархлар • Иштирокчилар"};
   return `<article class="market-intel-card" onclick="openPlatform('${p.key}')">
    <div class="market-card-head">
     <div class="market-brand">${brandLogo(p.key,p)}</div>
     <div class="market-card-title">
      <b>${esc(p.trade_type||p.title)}</b>
      <small>${esc(p.source||p.title)}</small>
     </div>
     <span class="market-live ${p.exists?'online':'offline'}">${p.exists?'ONLINE':'OFFLINE'}</span>
    </div>
    <div class="market-card-kpi">
     <strong>${num(p.rows||0)}</strong>
     <small>${esc(m.metric)}</small>
    </div>
    <div class="market-card-features">${esc(m.features)}</div>
    <div class="market-card-action">
     <b>Бозорни таҳлил қилиш</b>
     <span>&rarr;</span>
    </div>
   </article>`;
 }).join("")}
 </div>`;
}

async function showActiveLots(){
 current="active";navActive("active");title.textContent="Фаол лотлар";setSourceContext("фаол лот манбалари • xarid.uzex.uz • xt-xarid.uz • etender.uzex.uz • Shaffof Xarid • MC.UZ");
 app.innerHTML='<div class="loading">Фаол лот манбалари текширилмоқда…</div>';
 try{
  let ps=await get("/api/pending/platforms");
  app.innerHTML=`<div class="notice">bidata Business Intelligence Platform • Фаол ва кутилаётган харидлар • READ-ONLY</div><div class="cards">${ps.map(p=>`<div class="card platform-card branded-platform-card" onclick="openPending('${p.key}')"><div class="platform-card-logo">${brandLogo(p.key,p)}</div><h4>${esc(p.trade_type||p.title)}</h4><small class="platform-source-name">Маълумот манбаи: <b>${esc(p.source||p.title)}</b></small><br><small class="${p.exists?'ok':'bad'}">${p.exists?'● ONLINE':'● DB ТОПИЛМАДИ'}</small><br><small>${p.rows!=null?num(p.rows)+' қатор':''}</small></div>`).join("")}</div>`;
 }catch(e){app.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
}
let pendingKey=null,pendingOffset=0;
async function openPending(k){
 pendingKey=k;pendingOffset=0;title.textContent="Фаол лотлар";
 const pp=PLATFORM_BRAND[k]||{};setSourceContext(`${pp.source||k} • ${pp.trade||"Фаол лотлар"}`);
 renderPendingList();
}
async function renderPendingList(){
 app.innerHTML=`<div class="panel pending-toolbar"><button class="btn ghost" id="backActive">← Платформалар</button><input id="pendingQ" placeholder="Лот, товар, буюртмачи, статус..."><button class="btn primary" id="pendingSearch">Қидириш</button></div><div class="panel table-panel"><div class="table-tools"><span>Фаол лотлар</span><div><button class="btn ghost" id="pPrev">←</button><button class="btn ghost" id="pNext">→</button></div></div><div class="scroll"><table><thead><tr><th>ID</th><th>ЛОТ №</th><th>САНА</th><th>ЯКУНЛАНИШ</th><th>НОМИ</th><th>СУММА</th><th>БУЮРТМАЧИ</th><th>РЕГИОН</th><th>СТАТУС</th></tr></thead><tbody id="pendingRows"><tr><td colspan="9">Юкланмоқда…</td></tr></tbody></table></div></div>`;
 $("#backActive").onclick=showActiveLots;$("#pendingSearch").onclick=()=>{pendingOffset=0;loadPendingRows()};$("#pendingQ").onkeydown=e=>{if(e.key==="Enter"){pendingOffset=0;loadPendingRows()}};$("#pPrev").onclick=()=>{pendingOffset=Math.max(0,pendingOffset-50);loadPendingRows()};$("#pNext").onclick=()=>{pendingOffset+=50;loadPendingRows()};loadPendingRows();
}
async function loadPendingRows(){
 try{
  let q=encodeURIComponent($("#pendingQ")?.value||"");
  let d=await get(`/api/pending/${pendingKey}/list?limit=50&offset=${pendingOffset}&q=${q}`);
  $("#pendingRows").innerHTML=d.rows.map(r=>`<tr class="clickrow" onclick="openPendingDetail('${pendingKey}','${esc(r.id)}')"><td>${esc(r.id)}</td><td>${esc(r.display)}</td><td>${esc(r.date)}</td><td>${esc(r.deadline)}</td><td title="${esc(r.product)}">${esc(r.product)}</td><td class="money">${money(r.amount)}</td><td>${esc(r.customer)}</td><td>${esc(r.region)}</td><td>${esc(r.status)}</td></tr>`).join("")||'<tr><td colspan="9">Маълумот йўқ</td></tr>';
 }catch(e){$("#pendingRows").innerHTML=`<tr><td colspan="9">${esc(e.message)}</td></tr>`}
}
async function openPendingDetail(k,id){
 title.textContent="Лот карточкаси";app.innerHTML='<div class="loading">Лот очилмоқда…</div>';
 try{
  let d=await get(`/api/pending/${k}/detail/${encodeURIComponent(id)}`);
  const rec=Object.entries(d.record).filter(([k])=>!k.toLowerCase().includes("json"));
  let extras=Object.entries(d.extras).map(([name,rows])=>rows?.length?`<div class="section-title"><h3>${esc(name)}</h3><small>${rows.length} та</small></div>${genericTable(rows)}`:"").join("");
  app.innerHTML=`<div class="detail-actions"><button class="btn ghost" id="backPending">← Рўйхатга қайтиш</button><a class="btn primary linkbtn" href="/api/pending/${k}/detail/${encodeURIComponent(id)}/pdf">PDF юклаш</a></div><div class="detail-hero"><div><small>${esc(d.title)}</small><h2>${esc(d.record.name||d.record.product_name||d.record.category_name||d.record.unique_name||"Лот карточкаси")}</h2><p>ID: ${esc(id)}</p></div><div class="detail-badge">REAL DATA<br><b>READ-ONLY</b></div></div><div class="panel detail-grid">${rec.map(([a,v])=>`<div><small>${esc(a)}</small><b>${esc(v)}</b></div>`).join("")}</div>${extras}`;
  $("#backPending").onclick=renderPendingList;
 }catch(e){app.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}
}
function genericTable(rows){
 if(!rows||!rows.length)return "";
 let cols=Object.keys(rows[0]).filter(x=>!x.toLowerCase().includes("json")).slice(0,10);
 return `<div class="panel table-panel"><div class="scroll"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0,150).map(r=>`<tr>${cols.map(c=>`<td title="${esc(r[c])}">${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}


/* ===== bidata DAILY DIGEST PAGE V2 ===== */

function digestPct(v){
  if(v===null || v===undefined)return "\u2014";
  const n=Number(v||0);
  return `${n>0?"+":""}${n.toFixed(2)}%`;
}

function digestTrend(v){
  const n=Number(v||0);
  return n>0 ? "digest-up" : n<0 ? "digest-down" : "digest-flat";
}

function digestMoney(v){ return money(Number(v||0)); }

function digestList(titleText, rows, type="count"){
  const data=Array.isArray(rows)?rows:[];
  return `
    <article class="dg-card">
      <div class="dg-card-head"><h3>${esc(titleText)}</h3><span>TOP ${data.length}</span></div>
      <div class="dg-list">
        ${data.length ? data.map((r,i)=>{
          const name=r.name || r.lot || "\u2014";
          let value="";
          if(type==="money") value=digestMoney(r.contract||0);
          else if(type==="product") value=`${num(r.quantity||0)} ${esc(r.unit_name||"")} \u2022 ${num(r.deals_count||0)} \u0441\u0430\u0432\u0434\u043e`;
          else value=`${num(r.deals_count||0)} \u0441\u0430\u0432\u0434\u043e`;
          return `<div class="dg-row"><b>${i+1}</b><div class="dg-row-main"><strong title="${esc(name)}">${esc(name)}</strong>${r.customer?`<small>${esc(r.customer)}</small>`:""}${r.supplier?`<small>${esc(r.supplier)}</small>`:""}</div><span>${value}</span></div>`;
        }).join("") : '<div class="dg-empty">\u041c\u0430\u044a\u043b\u0443\u043c\u043e\u0442 \u0439\u045e\u049b</div>'}
      </div>
    </article>`;
}

function digestTrendCard(d){
  return `
    <article class="dg-card dg-trend-card">
      <div class="dg-card-head"><h3>\u041a\u0443\u043d\u043b\u0438\u043a \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430</h3><span>\u041a\u0415\u0427\u0410\u0413\u0418 \u041a\u0423\u041d\u0413\u0410</span></div>
      <div class="dg-trend-grid">
        <div><small>\u0421\u0430\u0432\u0434\u043e\u043b\u0430\u0440 \u0441\u043e\u043d\u0438</small><b class="${digestTrend(d.deals_change_pct)}">${digestPct(d.deals_change_pct)}</b><span>${num(d.previous_deals||0)} \u2192 ${num(d.deals_count||0)}</span><i class="${Number(d.deals_change_pct||0)<0?'down':'up'}"></i></div>
        <div><small>\u0421\u0430\u0432\u0434\u043e \u04b3\u0430\u0436\u043c\u0438</small><b class="${digestTrend(d.contract_change_pct)}">${digestPct(d.contract_change_pct)}</b><span>${digestMoney(d.previous_contract||0)} \u2192 ${digestMoney(d.total_contract||0)}</span><i class="${Number(d.contract_change_pct||0)<0?'down':'up'}"></i></div>
      </div>
    </article>`;
}

function digestMarketSection(d,tone="green"){
  return `
    <section class="dg-market dg-tone-${tone}">
      <div class="dg-market-head">
        <div class="dg-market-title"><div class="dg-market-icon">${tone==="blue"?"\u25a3":"\u25a2"}</div><div><span>\u041f\u041b\u0410\u0422\u0424\u041e\u0420\u041c\u0410</span><h2>${esc(d.title||"")}</h2></div></div>
        <div class="dg-market-total"><strong>${digestMoney(d.total_contract||0)}</strong><small>\u0441\u0430\u0432\u0434\u043e \u04b3\u0430\u0436\u043c\u0438</small></div>
      </div>
      <div class="dg-mini-kpis">
        <article><small>\u0421\u0430\u0432\u0434\u043e\u043b\u0430\u0440</small><b>${num(d.deals_count||0)}</b></article>
        <article><small>\u041b\u043e\u0442\u043b\u0430\u0440</small><b>${num(d.lots_count||0)}</b></article>
        <article><small>\u0411\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438\u043b\u0430\u0440</small><b>${num(d.customers_count||0)}</b></article>
        <article><small>\u0415\u0442\u043a\u0430\u0437\u0438\u0431 \u0431\u0435\u0440\u0443\u0432\u0447\u0438\u043b\u0430\u0440</small><b>${num(d.suppliers_count||0)}</b></article>
      </div>
      <div class="dg-grid2">${digestList("\u042d\u043d\u0433 \u0439\u0438\u0440\u0438\u043a \u0441\u0430\u0432\u0434\u043e\u043b\u0430\u0440",d.top_deals,"money")}${digestList("TOP \u0442\u043e\u0432\u0430\u0440\u043b\u0430\u0440",d.top_products,"product")}</div>
      <div class="dg-grid3">${digestList("TOP \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u043b\u0430\u0440",d.top_categories)}${digestList("TOP \u0440\u0435\u0433\u0438\u043e\u043d\u043b\u0430\u0440",d.top_regions)}${digestList("TOP \u0431\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438\u043b\u0430\u0440",d.top_customers)}</div>
      <div class="dg-grid2 dg-bottom-grid">${digestList("TOP \u0435\u0442\u043a\u0430\u0437\u0438\u0431 \u0431\u0435\u0440\u0443\u0432\u0447\u0438\u043b\u0430\u0440",d.top_suppliers)}${digestTrendCard(d)}</div>
    </section>`;
}

function digestInsightCard(icon,titleText,body,value,cls=""){
  return `<article class="dg-insight-card ${cls}"><div class="dg-insight-icon">${icon}</div><div><h4>${esc(titleText)}</h4><p>${body}</p><strong>${value}</strong></div></article>`;
}

function digestInsights(d){
  const shop=d.markets?.shop||{}, national=d.markets?.national||{};
  const total=Number(d.total_contract||0);
  const nationalShare=total>0?Number(national.total_contract||0)/total*100:0;
  const activeMarket=Number(shop.deals_count||0)>=Number(national.deals_count||0)?shop:national;
  const regions=[...(shop.top_regions||[]),...(national.top_regions||[])].sort((a,b)=>Number(b.deals_count||0)-Number(a.deals_count||0));
  const topRegion=regions[0]||{name:"\u2014",deals_count:0};
  const decline=Math.min(Number(d.deals_change_pct||0),Number(d.contract_change_pct||0));
  return `
    <section class="dg-insights">
      <div class="dg-insights-head"><span>bidata MARKET INTELLIGENCE</span><h3>\u0416\u0430\u043c\u0438 \u0431\u043e\u0437\u043e\u0440 \u0431\u045e\u0439\u0438\u0447\u0430 \u043c\u0443\u04b3\u0438\u043c \u0438\u043d\u0441\u0430\u0439\u0442\u043b\u0430\u0440</h3></div>
      <div class="dg-insight-grid">
        ${digestInsightCard("\u2198","\u041a\u0443\u043d\u043b\u0438\u043a \u0442\u0435\u043d\u0434\u0435\u043d\u0446\u0438\u044f",`\u0421\u0430\u0432\u0434\u043e\u043b\u0430\u0440 ${digestPct(d.deals_change_pct)}, \u04b3\u0430\u0436\u043c ${digestPct(d.contract_change_pct)} \u045e\u0437\u0433\u0430\u0440\u0434\u0438.`,digestPct(decline),"danger")}
        ${digestInsightCard("\u25d4","\u04b2\u0430\u0436\u043c \u0443\u043b\u0443\u0448\u0438",`\u041c\u0438\u043b\u043b\u0438\u0439 \u0434\u045e\u043a\u043e\u043d \u0443\u043c\u0443\u043c\u0438\u0439 \u04b3\u0430\u0436\u043c\u043d\u0438\u043d\u0433 ${nationalShare.toFixed(1)}% \u0438\u043d\u0438 \u0442\u0430\u0448\u043a\u0438\u043b \u044d\u0442\u0434\u0438.`,`${nationalShare.toFixed(1)}%`,"blue")}
        ${digestInsightCard("\u2605","\u042d\u043d\u0433 \u0444\u0430\u043e\u043b \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430",`${esc(activeMarket.title||"\u2014")} \u0441\u0430\u0432\u0434\u043e\u043b\u0430\u0440 \u0441\u043e\u043d\u0438 \u0431\u045e\u0439\u0438\u0447\u0430 \u0435\u0442\u0430\u043a\u0447\u0438.`,num(activeMarket.deals_count||0),"violet")}
        ${digestInsightCard("\u25cf","\u042d\u043d\u0433 \u0444\u0430\u043e\u043b \u0440\u0435\u0433\u0438\u043e\u043d",`${esc(topRegion.name||"\u2014")} TOP \u0440\u0435\u0433\u0438\u043e\u043d\u043b\u0430\u0440 \u043e\u0440\u0430\u0441\u0438\u0434\u0430 \u0435\u0442\u0430\u043a\u0447\u0438.`,`${num(topRegion.deals_count||0)} \u0441\u0430\u0432\u0434\u043e`,"orange")}
        ${digestInsightCard("\u25f7","\u040e\u0440\u0442\u0430\u0447\u0430 \u0431\u0438\u0442\u0438\u043c","\u0411\u043e\u0437\u043e\u0440 \u0431\u045e\u0439\u0438\u0447\u0430 \u0431\u0438\u0440 \u0431\u0438\u0442\u0438\u043c\u043d\u0438\u043d\u0433 \u045e\u0440\u0442\u0430\u0447\u0430 \u049b\u0438\u0439\u043c\u0430\u0442\u0438.",digestMoney(d.average_deal||0),"cyan")}
      </div>
    </section>`;
}

async function loadDailyDigest(){
  const box=$("#digestContent");
  const dateValue=$("#digestDate")?.value||"";
  if(!box)return;
  box.innerHTML='<div class="loading">\u041a\u0443\u043d\u043b\u0438\u043a \u0434\u0430\u0439\u0436\u0435\u0441\u0442 \u044e\u043a\u043b\u0430\u043d\u043c\u043e\u049b\u0434\u0430\u2026</div>';
  try{
    const d=await get(`/api/digest/combined?date=${encodeURIComponent(dateValue)}`);
    const shop=d.markets?.shop||{}, national=d.markets?.national||{};
    box.innerHTML=`
      <section class="dg-summary">
        <div class="dg-summary-head">
          <div><span>bidata DAILY MARKET INTELLIGENCE</span><h2>${esc(d.title||"\u041a\u0443\u043d\u043b\u0438\u043a \u0431\u043e\u0437\u043e\u0440 \u0434\u0430\u0439\u0436\u0435\u0441\u0442\u0438")}</h2><p>${esc(d.date||dateValue)} \u0441\u0430\u043d\u0430\u0441\u0438 \u0431\u045e\u0439\u0438\u0447\u0430 \u0443\u043c\u0443\u043c\u0438\u0439 \u043d\u0430\u0442\u0438\u0436\u0430</p></div>
          <div class="dg-total"><small>\u0423\u041c\u0423\u041c\u0418\u0419 \u0421\u0410\u0412\u0414\u041e \u04b2\u0410\u0416\u041c\u0418</small><strong>${digestMoney(d.total_contract||0)}</strong></div>
        </div>
        <div class="dg-kpis">
          <article><i>\u25a3</i><div><small>\u0421\u0430\u0432\u0434\u043e\u043b\u0430\u0440</small><b>${num(d.deals_count||0)}</b><em class="${digestTrend(d.deals_change_pct)}">${digestPct(d.deals_change_pct)}</em></div></article>
          <article><i>\u25a6</i><div><small>\u0421\u0430\u0432\u0434\u043e \u04b3\u0430\u0436\u043c\u0438</small><b>${digestMoney(d.total_contract||0)}</b><em class="${digestTrend(d.contract_change_pct)}">${digestPct(d.contract_change_pct)}</em></div></article>
          <article><i>\u2659</i><div><small>\u0411\u0443\u044e\u0440\u0442\u043c\u0430\u0447\u0438\u043b\u0430\u0440</small><b>${num(d.customers_count||0)}</b><em>2 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430</em></div></article>
          <article><i>\u25a4</i><div><small>\u0415\u0442\u043a\u0430\u0437\u0438\u0431 \u0431\u0435\u0440\u0443\u0432\u0447\u0438\u043b\u0430\u0440</small><b>${num(d.suppliers_count||0)}</b><em>2 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0430</em></div></article>
          <article><i>\u25a7</i><div><small>\u0422\u043e\u0432\u0430\u0440\u043b\u0430\u0440</small><b>${num(d.products_count||0)}</b><em>\u043a\u0443\u043d\u043b\u0438\u043a \u043a\u0435\u0441\u0438\u043c</em></div></article>
          <article><i>\u25a5</i><div><small>\u040e\u0440\u0442\u0430\u0447\u0430 \u0431\u0438\u0442\u0438\u043c</small><b>${digestMoney(d.average_deal||0)}</b><em>\u0441\u045e\u043c</em></div></article>
        </div>
        <div class="dg-summary-line"><i>\u25c9</i><span><b>\u041a\u0423\u041d\u041b\u0418\u041a \u0425\u0423\u041b\u041e\u0421\u0410:</b> ${num(d.deals_count||0)} \u0442\u0430 \u0441\u0430\u0432\u0434\u043e, \u0436\u0430\u043c\u0438 ${digestMoney(d.total_contract||0)} \u0441\u045e\u043c. \u0421\u0430\u0432\u0434\u043e\u043b\u0430\u0440 \u0441\u043e\u043d\u0438 <strong class="${digestTrend(d.deals_change_pct)}">${digestPct(d.deals_change_pct)}</strong>, \u04b3\u0430\u0436\u043c <strong class="${digestTrend(d.contract_change_pct)}">${digestPct(d.contract_change_pct)}</strong> \u045e\u0437\u0433\u0430\u0440\u0433\u0430\u043d.</span></div>
      </section>
      <div class="dg-market-grid">${digestMarketSection(shop,"green")}${digestMarketSection(national,"blue")}</div>
      ${digestInsights(d)}
    `;
  }catch(e){
    box.innerHTML=`<div class="notice error"><b>\u041a\u0443\u043d\u043b\u0438\u043a \u0434\u0430\u0439\u0436\u0435\u0441\u0442\u043d\u0438 \u044e\u043a\u043b\u0430\u0431 \u0431\u045e\u043b\u043c\u0430\u0434\u0438</b><br>${esc(e.message)}</div>`;
  }
}

function showDailyDigest(){
  current="daily_digest";
  setSourceContext("bidata йиғма дайжест • 9 та савдо йўналиши");
  navActive("daily_digest");
  title.textContent="\u041a\u0443\u043d\u043b\u0438\u043a \u0434\u0430\u0439\u0436\u0435\u0441\u0442";
  sidebar.classList.remove("open");
  const dt=new Date();dt.setDate(dt.getDate()-1);
  const defaultDate=dt.toISOString().slice(0,10);
  app.innerHTML=`
    <section class="dg-page-head">
      <div><span>bidata MARKET INTELLIGENCE</span><h2>\u041a\u0443\u043d\u043b\u0438\u043a \u0431\u043e\u0437\u043e\u0440 \u0434\u0430\u0439\u0436\u0435\u0441\u0442\u0438</h2><p>\u042d\u043b\u0435\u043a\u0442\u0440\u043e\u043d \u0434\u045e\u043a\u043e\u043d \u0432\u0430 \u041c\u0438\u043b\u043b\u0438\u0439 \u0434\u045e\u043a\u043e\u043d \u0441\u0430\u0432\u0434\u043e\u043b\u0430\u0440\u0438\u043d\u0438 \u0431\u0438\u0440 \u043a\u0443\u043d \u043a\u0435\u0441\u0438\u043c\u0438\u0434\u0430 \u0442\u0430\u04b3\u043b\u0438\u043b \u049b\u0438\u043b\u0438\u043d\u0433.</p></div>
      <div class="dg-date"><label>\u0421\u0430\u043d\u0430</label><input type="date" id="digestDate" value="${defaultDate}"><button class="btn primary" id="digestApply">\u041a\u045e\u0440\u0441\u0430\u0442\u0438\u0448</button></div>
    </section>
    <div id="digestContent"><div class="loading">\u0414\u0430\u0439\u0436\u0435\u0441\u0442 \u044e\u043a\u043b\u0430\u043d\u043c\u043e\u049b\u0434\u0430\u2026</div></div>`;
  $("#digestApply").onclick=loadDailyDigest;
  $("#digestDate").onchange=loadDailyDigest;
  loadDailyDigest();
}


// === bidata TENDER ANALYTICS UI V1 ===

let tenderOffset = 0;
const TENDER_PAGE_SIZE=24;

function tenderMoney(v){
  const n=Number(v||0);
  if(!Number.isFinite(n)) return "0";
  if(n>=1e12) return (n/1e12).toFixed(2)+" трлн";
  if(n>=1e9)  return (n/1e9).toFixed(2)+" млрд";
  if(n>=1e6)  return (n/1e6).toFixed(1)+" млн";
  return num(Math.round(n));
}

function tenderQuery(includePage=true){
  const p=new URLSearchParams();

  const market=$("#taMarket")?.value||"";
  const subject=$("#taSubject")?.value||"";
const region=$("#taRegion")?.value||"";
  const q=($("#taQ")?.value||"").trim();

  if(market) p.set("market",market);
  if(subject) p.set("subject_group",subject);
if(region) p.set("region",region);
  if(q) p.set("q",q);

  if(includePage){
    p.set("limit",String(TENDER_PAGE_SIZE));
    p.set("offset",String(tenderOffset));
  }

  return p.toString();
}


function tenderSubjectOptionsHTML(items){
  const groups = [
    {
      title:"Қурилиш ва инфратузилма",
      test:s=>[
        "қурилиш",
        "таъмир",
        "реконструк",
        "модерниза",
        "лойиҳа",
        "инженер",
        "тэо",
        "йўл",
        "транспорт инфратузил",
        "иррига",
        "сув таъмино"
      ].some(k=>s.includes(k))
    },
    {
      title:"IT, алоқа ва электроника",
      test:s=>[
        "it /",
        "компьютер",
        "электроника",
        "электр жиҳоз",
        "телеком",
        "алоқа"
      ].some(k=>s.includes(k))
    },
    {
      title:"Тиббиёт ва илмий жиҳозлар",
      test:s=>[
        "тиббиёт",
        "фарма",
        "лаборатор",
        "ўлчов",
        "илмий жиҳоз"
      ].some(k=>s.includes(k))
    },
    {
      title:"Саноат, техника ва транспорт",
      test:s=>[
        "саноат",
        "ускуна",
        "машина",
        "эҳтиёт қисм",
        "транспорт",
        "резина",
        "муҳр",
        "мойлаш",
        "техник кимё",
        "ёқилғи",
        "нефть",
        "газ",
        "кончилик",
        "металл"
      ].some(k=>s.includes(k))
    },
    {
      title:"Товарлар ва жиҳозлар",
      test:s=>[
        "мебель",
        "инвентар",
        "озиқ",
        "кейтеринг",
        "таълим / ўқув",
        "жиҳоз"
      ].some(k=>s.includes(k))
    },
    {
      title:"Хизматлар",
      test:s=>[
        "консалт",
        "кадастр",
        "кўчмас мулк",
        "геология",
        "бурғилаш",
        "қидирув",
        "ободонлаш",
        "кўкаламзор"
      ].some(k=>s.includes(k))
    }
  ];

  const buckets = {};
  groups.forEach(g=>buckets[g.title]=[]);
  buckets["Бошқа харид предметлари"]=[];

  (items||[]).forEach(item=>{
    const value=String(item||"").trim();
    if(!value)return;

    const s=value.toLowerCase();

    const group=groups.find(g=>g.test(s));

    if(group){
      buckets[group.title].push(value);
    }else{
      buckets["Бошқа харид предметлари"].push(value);
    }
  });

  let html='<option value="">Барча харид предметлари</option>';

  [
    ...groups.map(x=>x.title),
    "Бошқа харид предметлари"
  ].forEach(title=>{

    const rows=buckets[title]||[];
    if(!rows.length)return;

    rows.sort((a,b)=>a.localeCompare(b,"uz"));

    html+=`<optgroup label="${esc(title)}">`;

    rows.forEach(value=>{
      html+=`<option value="${esc(value)}">${esc(value)}</option>`;
    });

    html+="</optgroup>";
  });

  return html;
}


function tenderPlatformLogo(market){
  const icons={
    etender:"/static/platform-icons/etender.png",
    xt_xarid:"/static/platform-icons/xt.png",
    shaffof:"/static/platform-icons/shaffof.png",
    mc:"/static/platform-icons/mc.png"
  };

  const src=icons[market];
  if(!src)return "";

  return `<img src="${src}" class="tender-platform-logo" alt="">`;
}

// TENDER_FINANCE_V2: currencies are never added together.
function financeCurrency(v){return v==='UZS'?'сўм':v==='UNKNOWN'?'валюта аниқланмаган':(v||'валюта аниқланмаган');}
function financeMoney(v,c){return v==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v)+' '+financeCurrency(c);}
function financeTotals(d){const x=d.amounts_by_currency||{};return Object.keys(x).sort().map(c=>financeMoney(x[c],c)).join(' · ')||'—';}
function financeSummaryNote(d){return 'Мос тендерларнинг тўлиқ манба суммалари; валюталар алоҳида. Танланган позициялар: '+Object.entries(d.selected_item_amounts_by_currency||{}).map(([c,v])=>financeMoney(v,c)).join(' · ')+(d.missing_tender_amounts?' · Суммаси йўқ: '+d.missing_tender_amounts:'');}
function financeDetailNote(d){return `<section class="panel finance-note"><b>Манбадаги тендер қиймати: ${esc(financeMoney(d.source_tender_amount,d.currency))}</b><span>Барча юкланган позициялар: ${esc(financeMoney(d.all_item_amount,d.currency))}</span>${d.amount_difference!=null&&Math.abs(d.amount_difference)>0.01?`<span class="finance-difference">Манба суммаси билан фарқ: ${esc(financeMoney(d.amount_difference,d.currency))}. Позициялар тўлиқлиги текширилмоқда.</span>`:''}</section>`;}
function financeStatus(m,s){if(m==='mc'||m==='shaffof')return {'2':'Фаол лот'}[s]||s;return {'open':'Эълон қилинган','check_docs':'Ҳужжатлар текширилмоқда','tech_checking':'Техник текширув','commercial_checking':'Тижорий текширув','quality_checking':'Сифат текшируви'}[s]||s;}

function financeEtenderNote(d){
  if(d.all_item_amount==null)return '<div class="etd-finance-strip">Позициялар юкланмаган; қуйида манбадаги тендер қиймати кўрсатилган.</div>';
  if(d.amount_difference!=null && Math.abs(d.amount_difference)<=0.01)return '<div class="etd-finance-strip">Позициялар йиғиндиси манбадаги тендер қийматига мос.</div>';
  return `<div class="etd-finance-strip"><span>Юкланган позициялар: <b>${esc(financeMoney(d.all_item_amount,d.currency))}</b></span>${d.amount_difference!=null?`<span>Манба қиймати билан фарқ: <b>${esc(financeMoney(d.amount_difference,d.currency))}</b></span>`:''}</div>`;
}

async function showTenderAnalytics(){
  current="tender_analytics";
  navActive("tender_analytics");
  title.textContent="Тендер аналитикаси";

  app.innerHTML='<div class="loading">Тендер аналитикаси юкланмоқда…</div>';

  try{
    const [summary,filters]=await Promise.all([
      get("/api/tenders/active/summary"),
      get("/api/tenders/active/filters")
    ]);

    const tenderMarkets=filters.markets||[];
    const tenderMarketCount=tenderMarkets.length;
    const tenderMarketNames=tenderMarkets.map(x=>x.title).join(" • ");

    setSourceContext(
      `${tenderMarketCount} та тендер платформаси${tenderMarketNames ? " • " + tenderMarketNames : ""}`
    );

    app.innerHTML=`
      <section class="analytics-hero-mini tender-hero">
        <span>bidata TENDER INTELLIGENCE</span>
        <h2>Фаол тендерлар аналитикаси</h2>
        <p>
          ${tenderMarketCount} та тендер платформасидаги жорий харидларни предмет,
          соҳа, ҳудуд ва буюртмачи кесимида таҳлил қилинг.
        </p>
      </section>

      <div class="tender-kpis">
        <article class="panel tender-kpi">
          <small>ФАОЛ ТЕНДЕРЛАР</small>
          <strong id="taKpiTenders">${num(summary.tenders||0)}</strong>
          <span>та тендер</span>
        </article>

        <article class="panel tender-kpi">
          <small>ЛОТЛАР</small>
          <strong id="taKpiLots">${num(summary.lots||0)}</strong>
          <span>та лот</span>
        </article>

        <article class="panel tender-kpi">
          <small>ПОЗИЦИЯЛАР</small>
          <strong id="taKpiItems">${num(summary.items||0)}</strong>
          <span>та товар / позиция</span>
        </article>

        <article class="panel tender-kpi">
          <small>УМУМИЙ ҚИЙМАТ</small>
          <strong id="taKpiAmount">${esc(financeTotals(summary))}</strong>
          <span>Валюталар бўйича</span>
        </article>
      </div>
      <div class="finance-summary-note" id="taFinanceNote">${esc(financeSummaryNote(summary))}</div>

      <div class="panel tender-filter-panel">
        <div class="tender-filter-head">
          <div>
            <b>Фильтрлар</b>
            <small>Керакли тендерларни ажратиб олинг</small>
          </div>
          <button class="btn ghost" id="taReset">Тозалаш</button>
        </div>

        <div class="tender-filter-grid">
          <select id="taMarket">
            <option value="">Барча платформалар</option>
            ${(filters.markets||[]).map(x=>
              `<option value="${esc(x.key)}">${esc(x.title)} — ${num(x.tenders)}</option>`
            ).join("")}
          </select>

          <select id="taSubject">
            ${tenderSubjectOptionsHTML(filters.subject_groups||[])}
          </select>

          <select id="taRegion">
            <option value="">Барча ҳудудлар</option>
            ${(filters.regions||[]).map(x=>
              `<option value="${esc(x)}">${esc(x)}</option>`
            ).join("")}
          </select>

          <input
            id="taQ"
            placeholder="Товар, тендер ёки лот рақами..."
          >

          <button class="btn primary" id="taSearch">Қидириш</button>
        </div>
      </div>


      <div class="tender-top-toggle-bar">
        <button class="tender-top-toggle" data-target="taTopSubjectsPanel">
          Харид предметлари TOP-10
        </button>

        <button class="tender-top-toggle" data-target="taTopRegionsPanel">
          Ҳудудлар TOP-10
        </button>

        <button class="tender-top-toggle" data-target="taTopCustomersPanel">
          Буюртмачилар TOP-10
        </button>
      </div>

      <div class="tender-top-panels">

        <div class="panel tender-top-panel" id="taTopSubjectsPanel" hidden>
          <div class="tender-section-title">
            <div>
              <small>SUBJECT GROUP</small>
              <h3>TOP-10 харид предметлари</h3>
            </div>
          </div>

          <div id="taTopSubjects" class="tender-ranking">
            <div class="loading">Юкланмоқда…</div>
          </div>
        </div>

        <div class="panel tender-top-panel" id="taTopRegionsPanel" hidden>
          <div class="tender-section-title">
            <div>
              <small>REGIONS</small>
              <h3>TOP-10 ҳудудлар</h3>
            </div>
          </div>

          <div id="taTopRegions" class="tender-ranking">
            <div class="loading">Юкланмоқда…</div>
          </div>
        </div>

        <div class="panel tender-top-panel" id="taTopCustomersPanel" hidden>
          <div class="tender-section-title">
            <div>
              <small>CUSTOMERS</small>
              <h3>TOP-10 буюртмачилар</h3>
            </div>
          </div>

          <div id="taTopCustomers" class="tender-ranking">
            <div class="loading">Юкланмоқда…</div>
          </div>
        </div>

      </div>

      <div class="tender-platform-tabs" id="taPlatformTabs">
        <button class="active" data-market="">Барчаси</button>

        ${(filters.markets||[]).map(x=>`
          <button data-market="${esc(x.key)}">
            <span class="tender-tab-icon">
              ${tenderPlatformLogo(x.key)}
            </span>
            <span class="tender-tab-title">${esc(x.title)}</span>
            <span>${num(x.tenders||0)}</span>
          </button>
        `).join("")}
      </div>

      <div class="tender-list-section">

        <div class="tender-list-head">
          <div>
            <span class="tender-list-kicker">ACTIVE TENDERS</span>
            <h3>Фаол тендерлар</h3>
            <small id="taResultInfo"></small>
          </div>

          <div class="tender-page-actions">
            <button class="btn ghost" id="taPrev">← Олдинги</button>
            <button class="btn ghost" id="taNext">Кейинги →</button>
          </div>
        </div>

        <div id="taRows" class="tender-card-grid">
          <div class="tender-card-loading">Юкланмоқда…</div>
        </div>

      </div>
    `;


    document.querySelectorAll(".tender-top-toggle").forEach(btn=>{
      btn.onclick=()=>{
        const target=document.getElementById(btn.dataset.target);
        if(!target)return;

        const willOpen=target.hidden;

        document.querySelectorAll(".tender-top-panel").forEach(p=>{
          p.hidden=true;
        });

        document.querySelectorAll(".tender-top-toggle").forEach(b=>{
          b.classList.remove("active");
        });

        if(willOpen){
          target.hidden=false;
          btn.classList.add("active");
        }
      };
    });

    $("#taSearch").onclick=()=>{
      tenderOffset=0;
      loadTenderAnalyticsData();
    };

    $("#taQ").onkeydown=e=>{
      if(e.key==="Enter"){
        tenderOffset=0;
        loadTenderAnalyticsData();
      }
    };

    ["taMarket","taSubject","taRegion"].forEach(id=>{
      $("#"+id).onchange=()=>{

        if(id==="taMarket"){
          const m=$("#taMarket").value||"";

          document.querySelectorAll("#taPlatformTabs button").forEach(x=>
            x.classList.toggle("active",(x.dataset.market||"")===m)
          );
        }

        tenderOffset=0;
        loadTenderAnalyticsData();
      };
    });

    document.querySelectorAll("#taPlatformTabs button").forEach(btn=>{
      btn.onclick=()=>{
        const market=btn.dataset.market||"";

        $("#taMarket").value=market;

        document.querySelectorAll("#taPlatformTabs button").forEach(x=>
          x.classList.toggle("active",x===btn)
        );

        tenderOffset=0;
        loadTenderAnalyticsData();
      };
    });

    $("#taReset").onclick=()=>{
      $("#taMarket").value="";
      $("#taSubject").value="";
      $("#taRegion").value="";
      $("#taQ").value="";

      document.querySelectorAll("#taPlatformTabs button").forEach(x=>
        x.classList.toggle("active",(x.dataset.market||"")==="")
      );

      tenderOffset=0;
      loadTenderAnalyticsData();
    };

    $("#taPrev").onclick=()=>{
      tenderOffset=Math.max(0,tenderOffset-TENDER_PAGE_SIZE);
      loadTenderRows();
    };

    $("#taNext").onclick=()=>{
      tenderOffset+=TENDER_PAGE_SIZE;
      loadTenderRows();
    };

    await loadTenderAnalyticsData();

  }catch(e){
    app.innerHTML=`<div class="notice error">
      Тендер аналитикасини юклашда хатолик: ${esc(e.message)}
    </div>`;
  }
}

async function loadTenderAnalyticsData(){
  await Promise.all([
    loadTenderSummary(),
    loadTenderTop(),
    loadTenderRows()
  ]);
}

async function loadTenderSummary(){
  try{
    const qs=tenderQuery(false);
    const d=await get("/api/tenders/active/summary"+(qs?"?"+qs:""));

    $("#taKpiTenders").textContent=num(d.tenders||0);
    $("#taKpiLots").textContent=num(d.lots||0);
    $("#taKpiItems").textContent=num(d.items||0);
    $("#taKpiAmount").textContent=financeTotals(d);
    $("#taFinanceNote").textContent=financeSummaryNote(d);
    $("#taKpiLots").parentElement.querySelector("span").textContent=`${num(d.known_lots)} рақамли лот · ${num(d.tenders_without_lot_id)} тендерда лот рақами йўқ`;
  }catch(e){
    console.error("Tender summary:",e);
  }
}

function tenderRankHTML(rows){
  if(!rows?.length)
    return '<div class="notice">Маълумот топилмади</div>';

  const max=Math.max(...rows.map(x=>Number(x.tenders||0)),1);

  return rows.map((x,i)=>{
    const width=Math.max(4,Math.round(Number(x.tenders||0)/max*100));

    return `
      <div class="tender-rank-row">
        <span class="tender-rank-no">${i+1}</span>
        <div class="tender-rank-main">
          <div>
            <b>${esc(x.name||"—")}</b>
            <strong>${num(x.tenders||0)}</strong>
          </div>
          <div class="tender-rank-bar">
            <i style="width:${width}%"></i>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadTenderTop(){
  try{
    const p=new URLSearchParams();
    p.set("limit","10");

    const market=$("#taMarket")?.value||"";
    const subject=$("#taSubject")?.value||"";
    const region=$("#taRegion")?.value||"";
    const q=($("#taQ")?.value||"").trim();

    if(market) p.set("market",market);
    if(subject) p.set("subject_group",subject);
    if(region) p.set("region",region);
    if(q) p.set("q",q);

    const suffix="?"+p.toString();

    const [subjects,regions,customers]=await Promise.all([
      get("/api/tenders/active/top/subjects"+suffix),
      get("/api/tenders/active/top/regions"+suffix),
      get("/api/tenders/active/top/customers"+suffix)
    ]);

    if($("#taTopSubjects")) $("#taTopSubjects").innerHTML=tenderRankHTML(subjects,"subject");
    if($("#taTopRegions")) $("#taTopRegions").innerHTML=tenderRankHTML(regions,"region");
    if($("#taTopCustomers")) $("#taTopCustomers").innerHTML=tenderRankHTML(customers,"customer");

  }catch(e){
    const err=`<div class="notice error">${esc(e.message)}</div>`;

    if($("#taTopSubjects")) $("#taTopSubjects").innerHTML=err;
    if($("#taTopRegions")) $("#taTopRegions").innerHTML=err;
    if($("#taTopCustomers")) $("#taTopCustomers").innerHTML=err;
  }
}


async function loadTenderRows(){
  const body=$("#taRows");
  if(!body)return;

  body.innerHTML=`
    <div class="tender-card-loading">
      Тендерлар юкланмоқда…
    </div>
  `;

  try{
    const d=await get(
      "/api/tenders/active/grouped?"+tenderQuery(true)
    );

    const total=Number(d.total||0);
    const from=total ? tenderOffset+1 : 0;
    const to=Math.min(
      tenderOffset+TENDER_PAGE_SIZE,
      total
    );

    if($("#taResultInfo")){
      $("#taResultInfo").textContent=
        `${num(total)} та тендер • ${num(from)}–${num(to)}`;
    }

    if($("#taPrev"))
      $("#taPrev").disabled=tenderOffset<=0;

    if($("#taNext"))
      $("#taNext").disabled=
        tenderOffset+TENDER_PAGE_SIZE>=total;

    if(!d.items?.length){
      body.innerHTML=`
        <div class="tender-card-empty">
          Маълумот топилмади
        </div>
      `;
      return;
    }

    const fmtDate=v=>{
      if(!v)return "—";

      const s=String(v);
      const part=s.slice(0,10);

      const m=part.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if(!m)return part;

      return `${m[3]}.${m[2]}.${m[1]}`;
    };

    const shortText=(v,n=90)=>{
      const s=String(v||"").trim();
      if(!s)return "—";
      return s.length>n ? s.slice(0,n).trim()+"…" : s;
    };

    body.innerHTML=d.items.map(r=>{

      const market=r.market||"";
      const marketTitle=r.market_title||market||"—";

      const tender=String(r.source_tender_id||"—");
      const lot=String(r.source_lot_id||"");

      const name=
        r.tender_name||
        r.sample_product_name||
        "Тендер номи кўрсатилмаган";

      const subject=r.subject_group||"Бошқа харид предмети";
      const customer=r.customer_name||"—";
      const region=r.region_name||"—";
      const status=financeStatus(market,r.status||"—");

      const amount=Number(r.amount||0);
      const itemCount=Number(r.item_count||0);
      const lotCount=Number(r.lot_count||0);

      return `
        <article
          class="tender-card"
          tabindex="0"
          role="button"
          data-market="${esc(market)}"
          data-tender="${esc(tender)}"
          data-lot="${esc(lot)}"
          aria-label="Лот ${esc(lot)} маълумотларини очиш"
        >

          <div class="tender-card-top">
            <span class="tender-market-badge market-${esc(market)}">
              <span class="tender-market-icon">
                ${tenderPlatformLogo(market)}
              </span>
              <span>${esc(marketTitle)}</span>
            </span>

            <span class="tender-status-badge">
              ${esc(status)}
            </span>
          </div>

          <div class="tender-card-number">
            <small>\u0422\u0415\u041d\u0414\u0415\u0420 ID</small>
            <strong>${esc(tender)}</strong>
            <span>
              ${lotCount?num(lotCount)+" лот":"Лот рақами йўқ"}
              ${itemCount>0 ? "\u00b7 "+num(itemCount)+" \u043f\u043e\u0437\u0438\u0446\u0438\u044f" : ""}
            </span>
          </div>

          <h4 class="tender-card-title"
              title="${esc(name)}">
            ${esc(shortText(name,120))}
          </h4>

          <div class="tender-card-subject">
            <span>Харид предмети</span>
            <b>${esc(subject)}</b>
          </div>

          <div class="tender-card-meta">

            <div>
              <small>Буюртмачи</small>
              <b title="${esc(customer)}">
                ${esc(shortText(customer,55))}
              </b>
            </div>

            <div>
              <small>Ҳудуд</small>
              <b>${esc(region)}</b>
            </div>

          </div>

          <div class="tender-card-bottom">

            <div class="tender-card-money">
              <small>Умумий қиймат</small>
              <strong>
                ${esc(financeMoney(r.source_tender_amount,r.currency))}
              </strong>
            </div>

            <div class="tender-card-deadline">
              <small>Тугаш санаси</small>
              <b>${fmtDate(r.end_date)}</b>
            </div>

          </div>

          <div class="tender-card-footer">
            <span>
              ${lotCount?num(lotCount)+" лот":"Лот рақами йўқ"}
              ${itemCount>0
                ? "\u00b7 "+num(itemCount)+" \u043f\u043e\u0437\u0438\u0446\u0438\u044f"
                : "\u00b7 \u0422\u0435\u043d\u0434\u0435\u0440 \u043c\u0430\u044a\u043b\u0443\u043c\u043e\u0442\u0438"}
            </span>

            <span class="tender-card-open">
              \u0411\u0430\u0442\u0430\u0444\u0441\u0438\u043b \u2192
            </span>
          </div>

        </article>
      `;
    }).join("");

    document.querySelectorAll(".tender-card").forEach(card=>{

      const open=()=>{
        const market=card.dataset.market||"";
        const tender=card.dataset.tender||"";
        const lot=card.dataset.lot||"";

        openTenderDetail(market,tender,lot);
      };

      card.addEventListener("click",open);

      card.addEventListener("keydown",e=>{
        if(e.key==="Enter" || e.key===" "){
          e.preventDefault();
          open();
        }
      });
    });

  }catch(e){
    body.innerHTML=`
      <div class="notice error tender-card-error">
        ${esc(e.message)}
      </div>
    `;
  }
}



function renderEtenderDetail(d){
  const e=d.etender||{};
  const items=d.etender_positions||[];

  const yesNo=v=>{
    if(v===1 || v==="1" || v===true)return "Ҳа";
    if(v===0 || v==="0" || v===false)return "Йўқ";
    return "—";
  };

  const value=v=>
    (v===null || v===undefined || v==="") ? "—" : esc(v);

  const dateValue=v=>{
    if(!v)return "—";
    const s=String(v).replace("T"," ");
    return esc(s.slice(0,16));
  };

  const pct=v=>
    (v===null || v===undefined || v==="") ? "—" : `${num(v)}%`;

  const money=v=>
    (v===null || v===undefined || v==="") ? "—" : financeMoney(v,d.currency);

  const propertiesHTML=props=>{
    if(!Array.isArray(props) || !props.length)return "";

    return `
      <div class="etd-properties">
        ${props.map(p=>`
          <div class="etd-property">
            <span>${esc(p.Property_Name||"Хусусият")}</span>
            <b>${esc(p.User_Value||"—")}</b>
          </div>
        `).join("")}
      </div>
    `;
  };

  const productCards=items.length
    ? items.map((x,i)=>`
        <article class="etd-product etd-product-inline">
          <div class="etd-inline-no">
            <b>${i+1}</b>
          </div>

          <div class="etd-inline-name">
            <h3>${esc(x.product_name||"Номсиз позиция")}</h3>
            <div class="etd-inline-code">
              Код: ${esc(x.product_code||"—")}
            </div>
            ${
              x.category_name
                ? `<div class="etd-inline-category">${esc(x.category_name)}</div>`
                : ""
            }
          </div>

          <div class="etd-inline-cell">
            <small>МИҚДОР</small>
            <b>${x.quantity!=null ? num(x.quantity) : "—"} ${esc(x.unit_name||"")}</b>
          </div>

          <div class="etd-inline-cell">
            <small>БИРЛИК НАРХИ</small>
            <b>${money(x.price)}</b>
          </div>

          <div class="etd-inline-cell">
            <small>КАФОЛАТ</small>
            <b>
              ${
                x.guarantee_term!=null
                  ? `${num(x.guarantee_term)} ${esc(x.term_period_name||"")}`
                  : "—"
              }
            </b>
          </div>

          <div class="etd-inline-cell">
            <small>ЕТКАЗИБ БЕРИШ</small>
            <b>
              ${
                x.delivery_term!=null
                  ? `${num(x.delivery_term)} кун`
                  : "—"
              }
            </b>
          </div>

          <div class="etd-inline-cell">
            <small>ПОЗИЦИЯ СУММАСИ</small>
            <b>${money(x.cost)}</b>
          </div>

          <div class="etd-inline-tech">
            <small>ТЕХНИК ХУСУСИЯТЛАР</small>

            ${propertiesHTML(x.properties)}

            ${
              x.description
                ? `<div class="etd-inline-description">${esc(x.description)}</div>`
                : `<div class="etd-inline-description">—</div>`
            }
          </div>
        </article>
      `).join("")
    : `<div class="notice">Товар позициялари мавжуд эмас.</div>`;

  const sourceUrl=e.detail_url||d.public_url||"";

  return `
    <div class="etd-page">

      <div class="etd-back">
        <button class="btn ghost" onclick="showTenderAnalytics()">
          ← Тендер аналитикаси
        </button>
      </div>

      <section class="panel etd-hero">
        <div class="etd-platform">
          <div class="etd-logo">
            ${tenderPlatformLogo("etender")}
          </div>

          <div>
            <small>UZEX</small>
            <b>eTender</b>
          </div>
        </div>

        <div class="etd-hero-main">
          <div class="etd-status-row">
            <span class="etd-status">
              ${value(e.status_name||d.status)}
            </span>

            <span class="etd-lot">
              ЛОТ № <b>${value(e.display_no||d.source_lot_id)}</b>
            </span>

            <span class="etd-tender-id">
              Тендер ID: ${value(e.lot_id||d.source_tender_id)}
            </span>
          </div>

          <h1>${esc(d.tender_name||"Тендер")}</h1>

          <div class="etd-hero-bottom">
            <div>
              <small>БОШЛАНҒИЧ ҚИЙМАТ</small>
              <strong>
                ${money(e.start_cost!=null ? e.start_cost : d.amount)}
              </strong>
            </div>

            <div>
              <small>ХАРИД ПРЕДМЕТИ</small>
              <b>${value(d.subject_group)}</b>
            </div>

            <div>
              <small>ПОЗИЦИЯЛАР</small>
              <b>${num(items.length)}</b>
            </div>
          </div>
        </div>
      </section>


      <div class="etd-stat-grid">
        <div class="panel etd-stat">
          <small>БОШЛАНИШ</small>
          <b>${dateValue(e.start_date||d.start_date)}</b>
        </div>

        <div class="panel etd-stat">
          <small>ЯКУНЛАНИШ</small>
          <b>${dateValue(e.end_date||d.end_date)}</b>
        </div>

        <div class="panel etd-stat">
          <small>БАҲОЛАШ УСУЛИ</small>
          <b>${value(e.valuation_name)}</b>
        </div>

        <div class="panel etd-stat">
          <small>ТАКЛИФНИ АНИҚЛАШТИРИШ</small>
          <b>${dateValue(e.clarification_date)}</b>
        </div>
      </div>


      <div class="etd-two-col">

        <section class="panel etd-section">
          <div class="etd-section-title">
            <span>01</span>
            <div>
              <small>ТАШКИЛОТ</small>
              <h2>Буюртмачи</h2>
            </div>
          </div>

          <div class="etd-info-list">
            <div class="etd-wide">
              <small>БУЮРТМАЧИ</small>
              <b>${value(e.customer_name||d.customer_name)}</b>
            </div>

            <div>
              <small>СТИР</small>
              <b>${value(e.customer_tin||d.customer_inn)}</b>
            </div>

            <div>
              <small>ВИЛОЯТ</small>
              <b>${value(e.customer_region_name||d.region_name)}</b>
            </div>

            <div>
              <small>ТУМАН / ШАҲАР</small>
              <b>${value(e.customer_district_name||d.district_name)}</b>
            </div>

            <div>
              <small>ПОЧТА ИНДЕКСИ</small>
              <b>${value(e.customer_zip)}</b>
            </div>

            <div class="etd-wide">
              <small>МАНЗИЛ</small>
              <b>${value(e.customer_street||d.address)}</b>
            </div>
          </div>
        </section>


        <section class="panel etd-section">
          <div class="etd-section-title">
            <span>02</span>
            <div>
              <small>ЛОГИСТИКА</small>
              <h2>Етказиб бериш</h2>
            </div>
          </div>

          <div class="etd-info-list">
            <div>
              <small>ВИЛОЯТ</small>
              <b>${value(e.delivering_region_name)}</b>
            </div>

            <div>
              <small>ТУМАН / ШАҲАР</small>
              <b>${value(e.delivering_district_name)}</b>
            </div>

            <div class="etd-wide">
              <small>ЕТКАЗИБ БЕРИШ МАНЗИЛИ</small>
              <b>${value(e.delivering_address)}</b>
            </div>

            <div class="etd-wide">
              <small>АЛОҚА ТЕЛЕФОНИ</small>
              <b>${value(e.delivering_phone)}</b>
            </div>
          </div>
        </section>

      </div>


      <div class="etd-two-col">

        <section class="panel etd-section">
          <div class="etd-section-title">
            <span>03</span>
            <div>
              <small>МОЛИЯВИЙ ШАРТЛАР</small>
              <h2>Тўлов ва закалат</h2>
            </div>
          </div>

          <div class="etd-info-list">
            <div>
              <small>ТЎЛОВ ТУРИ</small>
              <b>${value(e.payment_type_name)}</b>
            </div>

            <div>
              <small>АВАНС</small>
              <b>${pct(e.advance_payment_perc)}</b>
            </div>

            <div>
              <small>ТЎЛОВ МУДДАТИ</small>
              <b>
                ${
                  e.term_payment_days!=null
                    ? `${num(e.term_payment_days)} кун`
                    : "—"
                }
              </b>
            </div>

            <div>
              <small>ЗАКАЛАТ</small>
              <b>${value(e.pledge_name)}</b>
            </div>

            <div>
              <small>ЗАКАЛАТ МИҚДОРИ</small>
              <b>${pct(e.pledge_value)}</b>
            </div>

            <div>
              <small>БАНК КАФОЛАТИ</small>
              <b>${yesNo(e.is_bank_guarantee)}</b>
            </div>

            <div class="etd-wide">
              <small>ЗАКАЛАТНИ БЛОКДАН ЧИҚАРИШ</small>
              <b>${value(e.block_pledge_type)}</b>
            </div>

            ${
              e.financing_source
                ? `
                  <div class="etd-wide">
                    <small>МОЛИЯЛАШТИРИШ МАНБАСИ</small>
                    <b>${value(e.financing_source)}</b>
                  </div>
                `
                : ""
            }
          </div>
        </section>


        <section class="panel etd-section">
          <div class="etd-section-title">
            <span>04</span>
            <div>
              <small>ТАНЛОВ МЕЗОНИ</small>
              <h2>Баҳолаш</h2>
            </div>
          </div>

          <div class="etd-score">
            <div class="etd-score-head">
              <span>Техник баҳо</span>
              <b>${pct(e.tech_coef)}</b>
            </div>

            <div class="etd-score-bar">
              <i style="width:${Number(e.tech_coef||0)}%"></i>
            </div>
          </div>

          <div class="etd-score">
            <div class="etd-score-head">
              <span>Нарх баҳоси</span>
              <b>${pct(e.cost_coef)}</b>
            </div>

            <div class="etd-score-bar">
              <i style="width:${Number(e.cost_coef||0)}%"></i>
            </div>
          </div>

          <div class="etd-min-score">
            <small>МИНИМАЛ ЎТИШ БАЛЛИ</small>
            <strong>${e.min_point!=null ? num(e.min_point) : "—"}</strong>
          </div>

          <div class="etd-mini-grid">
            <div>
              <small>КЎРИБ ЧИҚИШ</small>
              <b>${value(e.consider_procedure)}</b>
            </div>

            <div>
              <small>МАҲАЛЛИЙ ИШЛАБ ЧИҚАРУВЧИ</small>
              <b>${yesNo(e.is_local_manufacturs)}</b>
            </div>

            <div>
              <small>ИМТИЁЗЛАР</small>
              <b>${yesNo(e.has_benefits)}</b>
            </div>

            <div>
              <small>УЗАЙТИРИЛГАН</small>
              <b>${yesNo(e.is_prolonged)}</b>
            </div>
          </div>
        </section>

      </div>


      ${
        e.addon_description || e.technical_description
          ? `
            <section class="panel etd-section">
              <div class="etd-section-title">
                <span>05</span>
                <div>
                  <small>ТАЛАБЛАР</small>
                  <h2>Тендер шартлари ва техник маълумотлар</h2>
                </div>
              </div>

              <div class="etd-text-grid">
                ${
                  e.addon_description
                    ? `
                      <div>
                        <small>ҚЎШИМЧА ШАРТЛАР</small>
                        <p>${esc(e.addon_description)}</p>
                      </div>
                    `
                    : ""
                }

                ${
                  e.technical_description
                    ? `
                      <div>
                        <small>ТЕХНИК ТАЛАБЛАР</small>
                        <p>${esc(e.technical_description)}</p>
                      </div>
                    `
                    : ""
                }
              </div>
            </section>
          `
          : ""
      }


      <section class="etd-products-section">
        <div class="etd-products-head">
          <div>
            <small>ТЕНДЕР ТАРКИБИ</small>
            <h2>Товар / хизмат позициялари</h2>
          </div>

          <span>${num(items.length)} та позиция</span>
        </div>

        <div class="etd-products">
          ${productCards}
        </div>
      </section>


      ${
        sourceUrl
          ? `
            <div class="panel etd-source">
              <div>
                <small>РАСМИЙ МАНБА</small>
                <b>UZEX eTender</b>
              </div>

              <button
                class="btn primary"
                onclick="window.open('${esc(sourceUrl)}','_blank')">
                Манбада кўриш ↗
              </button>
            </div>
          `
          : ""
      }

    </div>
  `;
}



function renderMCDetail(d){
  const m=d.mc||{};
  const items=d.mc_items||[];
  const files=d.mc_files||[];
  const history=d.mc_history||[];


  const mcSourceUrl=()=>{
    const internalId=String(m.id || "").trim();
    const publicId=String(m.unique_name || m.lotid || "").trim();

    // 1) DB public_url бор бўлса, аввал шуни ишлатамиз
    if(m.public_url && String(m.public_url).trim()){
      return String(m.public_url).trim();
    }

    // 2) MC.UZ internal ID route
    if(internalId){
      return `https://tender.mc.uz/tender-list/tender/${encodeURIComponent(internalId)}/view`;
    }

    // 3) Shaffof fallback
    if(publicId){
      return `https://shaffofxarid.uz/tender/best-offer/${encodeURIComponent(publicId)}`;
    }

    return "https://tender.mc.uz/tender-list";
  };

  const esc=(v)=>{
    if(v===null || v===undefined || v==="") return "—";
    return String(v)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  };

  const money=(v)=>{
    if(v===null || v===undefined || v==="") return "—";
    const n=Number(v);
    if(!Number.isFinite(n)) return esc(v);
    return n.toLocaleString("ru-RU")+" UZS";
  };

  const mcDate=(v)=>{
    if(v===null || v===undefined || v==="") return "—";
    const raw=String(v).trim();

    try{
      const x=new Date(raw.replace(" ","T"));
      if(!Number.isNaN(x.getTime())){
        return x.toLocaleString("ru-RU",{
          day:"2-digit",
          month:"2-digit",
          year:"numeric",
          hour:"2-digit",
          minute:"2-digit"
        });
      }
    }catch(e){}

    return esc(raw);
  };

  const field=(label,value)=>`
    <div class="mcd-field">
      <span>${label}</span>
      <b>${value===null || value===undefined || value==="" ? "—" : esc(value)}</b>
    </div>
  `;

  const itemHtml=items.length
    ? items.map((x,i)=>{
        const props=x.properties||[];

        // Бир хил хусусиятларни битта блокка йиғамиз.
        // Масалан:
        // Единица измерения = усл. ед, усл. ед, услуга
        // -> Единица измерения = усл. ед / услуга
        const groupedProps=[];

        props.forEach(p=>{
          const name=String(p.prop_name || "Хусусият").trim();
          const value=String(p.val_name || "").trim();

          let g=groupedProps.find(z=>z.name===name);

          if(!g){
            g={name,values:[]};
            groupedProps.push(g);
          }

          if(value && !g.values.includes(value)){
            g.values.push(value);
          }
        });

        const propsHtml=groupedProps.length
          ? `
            <div class="mcd-props">
              ${groupedProps.map(p=>`
                <div class="mcd-prop">
                  <span>${esc(p.name)}</span>
                  <b>${esc(p.values.join(" / "))}</b>
                </div>
              `).join("")}
            </div>
          `
          : "";

        return `
          <div class="mcd-item">
            <div class="mcd-item-head">
              <div class="mcd-item-no">${String(i+1).padStart(2,"0")}</div>

              <div class="mcd-item-title">
                <b>${esc(x.product_name)}</b>
                <span>${esc(x.e_code)}</span>
              </div>
            </div>

            <div class="mcd-item-grid">
              ${field("Миқдор",x.quantity)}
              ${field("Ўлчов бирлиги",x.unit_name)}
              ${field("Бирлик нархи",money(x.unit_price))}
              ${field("Позиция суммаси",money(x.total_price))}
              ${field("Харажат коди",x.expense_code)}
              ${field("Харажат номи",x.expense_name)}
            </div>

            ${propsHtml}
          </div>
        `;
      }).join("")
    : `<div class="mcd-empty">Позициялар мавжуд эмас</div>`;

  const fileHtml=files.length
    ? files.map((f,i)=>{
        const url=f.file_url || f.file_path || "";

        return `
          <div class="mcd-file">
            <div class="mcd-file-no">${String(i+1).padStart(2,"0")}</div>

            <div class="mcd-file-info">
              <b>${esc(f.file_name || f.role || f.type || "Ҳужжат")}</b>
              <span>${esc(f.role || f.type)}</span>
            </div>

            ${
              url
                ? `<a href="${esc(url)}" target="_blank" rel="noopener">Очиш ↗</a>`
                : ""
            }
          </div>
        `;
      }).join("")
    : `<div class="mcd-empty">Ҳужжатлар мавжуд эмас</div>`;

  const historyHtml=history.length
    ? history.map((h,i)=>`
        <div class="mcd-history-item">
          <div class="mcd-history-no">${String(i+1).padStart(2,"0")}</div>

          <div>
            <b>${esc(String(h.status)==="2" ? "Фаол лот (код: 2)" : /^\d+$/.test(String(h.status)) ? "Ҳолат коди: "+h.status : h.status)}</b>
            <span>${mcDate(h.seen_at)}</span>
          </div>
        </div>
      `).join("")
    : `<div class="mcd-empty">Жараён тарихи мавжуд эмас</div>`;

  return `
    <div class="mcd-page">

      <button class="mcd-back" onclick="showTenderAnalytics()">
        ← Тендерларга қайтиш
      </button>

      <div class="mcd-hero">

        <div class="mcd-platform">
          <div class="mcd-platform-logo">
            <img src="/static/platform-icons/mc.png" alt="MC.UZ">
          </div>

          <div>
            <small>ТЕНДЕР ПЛАТФОРМАСИ</small>
            <b>MC.UZ</b>
          </div>
        </div>

        <div class="mcd-status">
          Фаол тендер
        </div>

        <h1>${esc(m.name)}</h1>

        <div class="mcd-lot">
          Лот № ${esc(m.unique_name || m.lotid)}
          <span>•</span>
          ID ${esc(m.id)}
        </div>

        <div class="mcd-main-price">
          <span>Бошланғич нарх</span>
          <strong>${money(m.start_price)}</strong>
          <small>${Number(m.with_nds)===1 ? "ҚҚС билан" : "ҚҚСсиз"}</small>
        </div>

        <div class="mcd-stat-grid">
          ${field("Эълон қилинган",mcDate(m.confirmed_date))}
          ${field("Таклиф бериш муддати",mcDate(m.placement_term))}
          ${field("Ишни тугатиш",mcDate(m.end_term_work))}
          ${field("Иштирокчилар",m.bidders_count)}
        </div>

      </div>


      <section class="mcd-section mcd-full">
        <h2><span>01</span> Харид ҳақида</h2>

        <div class="mcd-grid">
          ${field("Лот рақами",m.unique_name || m.lotid)}
          ${field("Тендер ID",m.id)}
          ${field("GNK ID",m.gnk_id)}
          ${field("Валюта",m.currency)}
          ${field("Кафолат фоизи",m.required_percent)}
          ${field("Кафолат суммаси",money(m.required_percent_amount))}
          ${field("Мураккаблик категорияси",m.complexity_category_name)}
          ${field("Категория",m.category_score_name)}
        </div>
      </section>


      <section class="mcd-section mcd-full">
        <h2>
          <span>02</span>
          Товар / хизмат позициялари
          <em>${items.length}</em>
        </h2>

        <div class="mcd-items">
          ${itemHtml}
        </div>
      </section>


      <section class="mcd-section">
        <h2><span>03</span> Буюртмачи</h2>

        <div class="mcd-grid">
          ${field("Ташкилот",m.customer_name)}
          ${field("СТИР",m.customer_inn)}
          ${field("Раҳбар",m.customer_director)}
          ${field("Телефон",m.customer_phone)}
          ${field("Email",m.customer_email)}
          ${field("Манзил",m.customer_address)}
        </div>
      </section>


      <section class="mcd-section">
        <h2><span>04</span> Объект ва манзил</h2>

        <div class="mcd-grid">
          ${field("Ҳудуд",m.region_name_uz || m.region_name)}
          ${field("Туман",m.district_name_uz || m.district_name)}
          ${field("Манзил",m.address)}
          ${field("Объект тури",m.object_type_name)}
          ${field("Хизмат тури",m.service_type_name)}
          ${field("Соҳа",m.soxa_name)}
        </div>
      </section>


      <section class="mcd-section">
        <h2><span>05</span> Молиялаштириш</h2>

        <div class="mcd-grid">
          ${field("Молиялаштириш манбаси",m.financial_source_name)}
          ${field("Дастур",m.program_name)}
          ${field("Бошланғич нарх",money(m.start_price))}
          ${field("ҚҚС",Number(m.with_nds)===1 ? "ҚҚС билан" : "ҚҚСсиз")}
          ${field("Таклиф муддати",m.placement_term_days ? m.placement_term_days+" кун" : null)}
          ${field("Иш муддати",m.end_term_work_days ? m.end_term_work_days+" кун" : null)}
        </div>
      </section>


      <section class="mcd-section">
        <h2><span>06</span> Консалтинг ташкилоти</h2>

        <div class="mcd-grid">
          ${field("Ташкилот",m.consulting_name)}
          ${field("СТИР",m.consulting_inn)}
          ${field("Телефон",m.consulting_phone)}
          ${field("Email",m.consulting_email)}
        </div>
      </section>


      <section class="mcd-section">
        <h2>
          <span>07</span>
          Ҳужжатлар
          <em>${files.length}</em>
        </h2>

        <div class="mcd-files">
          ${fileHtml}
        </div>
      </section>


      <section class="mcd-section mcd-full">
        <h2>
          <span>08</span>
          Жараён тарихи
          <em>${history.length}</em>
        </h2>

        <div class="mcd-history">
          ${historyHtml}
        </div>
      </section>


      <div class="mcd-source">
        <div>
          <small>РАСМИЙ МАНБА</small>
          <b>MC.UZ</b>
        </div>

        ${
          `
            <a
              href="${esc(mcSourceUrl())}"
              target="_blank"
              rel="noopener"
            >
              Манбада кўриш ↗
            </a>
          `
        }
      </div>

    </div>
  `;
}


function renderShaffofDetail(d){
  const s=d.shaffof||{};
  const files=d.shaffof_files||[];
  const process=d.shaffof_process||[];

  const shDate=(v)=>{
    if(v===null || v===undefined || v==="") return "—";

    const raw=String(v).trim();

    try{
      const d=new Date(raw);
      if(!Number.isNaN(d.getTime())){
        return d.toLocaleString("uz-UZ",{
          year:"numeric",
          month:"2-digit",
          day:"2-digit",
          hour:"2-digit",
          minute:"2-digit"
        });
      }
    }catch(e){}

    return raw;
  };

  const val=(v)=>(
    v===null || v===undefined || v===""
      ? "—"
      : esc(String(v))
  );

  const yesNo=(v)=>(
    Number(v)===1 ? "Ҳа" :
    Number(v)===0 ? "Йўқ" : "—"
  );

  const fileCards=files.length
    ? files.map((f,i)=>`
        <a class="shd-file"
           href="${esc(f.file_url||"#")}"
           target="_blank"
           rel="noopener">
          <div class="shd-file-no">${i+1}</div>
          <div>
            <b>${esc(f.file_name||"Ҳужжат")}</b>
            <small>${esc(f.file_type||f.source_kind||"")}</small>
          </div>
        </a>
      `).join("")
    : `<div class="shd-empty">Ҳужжатлар мавжуд эмас</div>`;

  const processRows=process.length
    ? process.map((x,i)=>`
        <div class="shd-process-row">
          <div class="shd-process-no">${i+1}</div>
          <div>
            <b>${val(x.action)}</b>
            <small>${shDate(x.created_at)}</small>
          </div>
        </div>
      `).join("")
    : `<div class="shd-empty">Жараён тарихи мавжуд эмас</div>`;

  return `
    <div class="shd-page">

      <button class="shd-back" onclick="showTenderAnalytics()">
        ← Тендерларга қайтиш
      </button>

      <section class="shd-hero">
        <div class="shd-hero-left">
          <div class="shd-platform">
            ${tenderPlatformLogo("shaffof")}
            <div>
              <b>Shaffof Xarid</b>
              <span>Қурилиш соҳасида давлат харидлари</span>
            </div>
          </div>

          <div class="shd-status-row">
            <span class="shd-status">${val(s.status_name)}</span>
            <span class="shd-contract-status">${val(s.contract_status_name)}</span>
          </div>

          <h1>${val(s.name)}</h1>

          <div class="shd-lot">
            Лот № <b>${val(s.unique_name)}</b>
            <span>Internal ID: ${val(s.id)}</span>
          </div>
        </div>

        <div class="shd-price">
          <small>БОШЛАНҒИЧ НАРХ</small>
          <b>${money(s.start_price)}</b>
          <span>ҚҚС: ${yesNo(s.with_nds)}</span>
        </div>
      </section>

      <section class="shd-stat-grid">
        <div>
          <small>ЭЪЛОН ҚИЛИНГАН</small>
          <b>${shDate(s.confirmed_date||s.created_at)}</b>
        </div>
        <div>
          <small>ТАКЛИФ ЯКУНИ</small>
          <b>${shDate(s.placement_term)}</b>
        </div>
        <div>
          <small>ИШНИ ЯКУНЛАШ</small>
          <b>${shDate(s.end_term_work)}</b>
        </div>
        <div>
          <small>ИШТИРОКЧИЛАР</small>
          <b>${val(s.bidders_count)}</b>
        </div>
      </section>

      <section class="shd-section">
        <h2><span>01</span> Харид ҳақида</h2>
        <div class="shd-info-grid">
          <div><small>Лот тури</small><b>${val(s.lot_type_name)}</b></div>
          <div><small>Объект тури</small><b>${val(s.object_type)}</b></div>
          <div><small>Хизмат тури</small><b>${val(s.service_type)}</b></div>
          <div><small>Мураккаблик тоифаси</small><b>${val(s.complexity_category)}</b></div>
          <div><small>Соҳа</small><b>${val(s.soxa)}</b></div>
          <div><small>Дастур</small><b>${val(s.dastur)}</b></div>
        </div>
      </section>

      <section class="shd-section">
        <h2><span>02</span> Буюртмачи</h2>
        <div class="shd-info-grid">
          <div class="shd-wide">
            <small>Ташкилот</small>
            <b>${val(s.customer_name)}</b>
          </div>
          <div><small>СТИР</small><b>${val(s.customer_inn)}</b></div>
          <div><small>Раҳбар</small><b>${val(s.customer_director)}</b></div>
        </div>
      </section>

      <section class="shd-section">
        <h2><span>03</span> Объект ва манзил</h2>
        <div class="shd-info-grid">
          <div><small>Ҳудуд</small><b>${val(s.region)}</b></div>
          <div><small>Туман</small><b>${val(s.district)}</b></div>
          <div class="shd-wide"><small>Манзил</small><b>${val(s.address)}</b></div>
          <div><small>Иш муддати</small><b>${val(s.end_term_work_days)} кун</b></div>
        </div>
      </section>

      <section class="shd-section">
        <h2><span>04</span> Молиявий шартлар</h2>
        <div class="shd-info-grid">
          <div><small>Молиялаштириш</small><b>${val(s.financial_source)}</b></div>
          <div><small>Бошланғич нарх</small><b>${money(s.start_price)}</b></div>
          <div><small>Талаб қилинадиган фоиз</small><b>${val(s.required_percent)}%</b></div>
          <div><small>Талаб суммаси</small><b>${money(s.required_percent_amount)}</b></div>
        </div>
      </section>

      <div class="shd-row-05-06">

      <section class="shd-section shd-consulting">
        <h2><span>05</span> Консалтинг ташкилоти</h2>
        <div class="shd-info-grid">
          <div class="shd-wide">
            <small>Ташкилот</small>
            <b>${val(s.consulting_name)}</b>
          </div>
          <div><small>СТИР</small><b>${val(s.consulting_inn)}</b></div>
          <div><small>Масъул шахс</small><b>${val(s.consulting_contact_person)}</b></div>
          <div><small>Телефон</small><b>${val(s.consulting_phone)}</b></div>
          <div><small>E-mail</small><b>${val(s.consulting_email)}</b></div>
        </div>
      </section>

      <section class="shd-section shd-docs">
        <h2><span>06</span> Ҳужжатлар</h2>
        <div class="shd-files">
          ${fileCards}
        </div>
      </section>

      </div>

      <section class="shd-section shd-history">
        <h2><span>07</span> Жараён тарихи</h2>
        <div class="shd-process">
          ${processRows}
        </div>
      </section>

      <div class="shd-source-card">
        <div class="shd-source-info">
          <small>РАСМИЙ МАНБА</small>
          <b>Shaffof Xarid</b>
        </div>

        <a
          class="shd-source-button"
          href="https://shaffofxarid.uz/tender/best-offer/${encodeURIComponent(s.id)}"
          target="_blank"
          rel="noopener"
        >
          Манбада кўриш ↗
        </a>
      </div>


    </div>
  `;
}


function renderXTXaridDetail(d){
  const x=d.xt_xarid||{};
  const lots=d.xt_lots||[];
  const lot=d.xt_selected_lot||{};
  const items=d.xt_items||[];

  const value=v=>
    (v===null || v===undefined || v==="") ? "—" : esc(v);

  const num=v=>{
    if(v===null || v===undefined || v==="") return "—";
    const n=Number(v);
    if(Number.isNaN(n)) return esc(v);
    return n.toLocaleString("ru-RU",{maximumFractionDigits:2});
  };

  const dateValue=v=>{
    if(!v)return "—";
    const s=String(v).replace("T"," ");
    return esc(s.slice(0,16));
  };

  const sourceUrl=
    x.source_url ||
    (x.proc_id
      ? `https://xt-xarid.uz/procedure/${encodeURIComponent(x.proc_id)}/core`
      : "https://xt-xarid.uz/");

  const procId=String(x.proc_id||d.source_tender_id||"");

  const lotCards=lots.map(l=>`
    <div
      class="xtd-lot-card ${String(l.lot_id)===String(lot.lot_id)?"active":""}"
      role="button"
      tabindex="0"
      data-xt-lot="${esc(String(l.lot_id||""))}"
      onclick="openTenderDetail('xt_xarid','${esc(procId)}','${esc(String(l.lot_id||""))}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
    >
      <div class="xtd-lot-top">
        <b>Лот № ${value(l.lot_id)}</b>
        <span>${value(l.currency)}</span>
      </div>
      <div class="xtd-lot-title">${value(l.title)}</div>
      <div class="xtd-lot-bottom">
        <span>Позициялар: <b>${num(l.item_count)}</b></span>
        <span>Сумма: <b>${num(l.start_amount)}</b></span>
      </div>
    </div>
  `).join("");

  const itemCards=items.map((it,idx)=>{
    const props=(it.properties||[]).map(p=>`
      <div class="xtd-prop">
        <span>${value(p.prop_name)}</span>
        <b>${value(p.prop_value)}</b>
      </div>
    `).join("");

    return `
      <section class="xtd-item">
        <div class="xtd-item-head">
          <div class="xtd-num">${idx+1}</div>
          <div class="xtd-item-main">
            <h3>${value(it.product_name)}</h3>
            <div class="xtd-code">${value(it.product_code)}</div>
          </div>
        </div>

        <div class="xtd-item-grid">
          <div>
            <span>Миқдор</span>
            <b>${num(it.quantity)}</b>
          </div>
          <div>
            <span>Ўлчов бирлиги</span>
            <b>${value(it.unit_name)}</b>
          </div>
          <div>
            <span>Бирлик нархи</span>
            <b>${num(it.unit_price)} ${value(it.currency)}</b>
          </div>
          <div>
            <span>Жами</span>
            <b>${num(it.total_price)} ${value(it.currency)}</b>
          </div>
          <div>
            <span>Етказиб бериш</span>
            <b>${num(it.delivery_period_days)} кун</b>
          </div>
          <div>
            <span>Кафолат</span>
            <b>${num(it.guarantee_days)} кун</b>
          </div>
          <div>
            <span>Ишлаб чиқарилган йил</span>
            <b>${value(it.production_year)}</b>
          </div>
          <div>
            <span>Категория</span>
            <b>${value(it.category_name)}</b>
          </div>
        </div>

        ${it.specification ? `
          <div class="xtd-spec">
            <span>Техник спецификация</span>
            <div>${value(it.specification)}</div>
          </div>
        ` : ""}

        ${it.delivery_address ? `
          <div class="xtd-address">
            <span>Етказиб бериш манзили</span>
            <div>${value(it.delivery_address)}</div>
          </div>
        ` : ""}

        ${props ? `
          <div class="xtd-props">
            <div class="xtd-subtitle">Техник хусусиятлар</div>
            ${props}
          </div>
        ` : ""}
      </section>
    `;
  }).join("");

  return `
    <div class="xtd-wrap">

      <div class="xtd-hero">
        <div>
          <button class="btn ghost" onclick="showTenderAnalytics()">
            ← Тендерларга қайтиш
          </button>

          <div class="xtd-brand">
            <img src="/static/platform-icons/xt.png" alt="XT-Xarid">
            <span>XT-Xarid Tender</span>
          </div>

          <h1>${value(x.name || d.tender_name || "XT-Xarid тендер")}</h1>

          <div class="xtd-meta">
            <span>Процедура: <b>${value(x.proc_id)}</b></span>
            <span>Статус: <b>${value(x.status)}</b></span>
            <span>Лотлар: <b>${num(x.lot_count)}</b></span>
            <span>Товарлар: <b>${num(x.good_count)}</b></span>
            <span>Иштирокчилар: <b>${num(x.participant_count)}</b></span>
          </div>
        </div>

      </div>

      <div class="xtd-grid">

        <section class="xtd-section">
          <div class="xtd-title"><span>01</span> Харид ҳақида</div>

          <div class="xtd-info-grid">
            <div>
              <span>Тендер рақами</span>
              <b>${value(x.lot_number)}</b>
            </div>
            <div>
              <span>Умумий сумма</span>
              <b>${num(x.total_amount)} ${value(x.currency)}</b>
            </div>
            <div>
              <span>Эълон қилинган сана</span>
              <b>${dateValue(x.publicated_at)}</b>
            </div>
            <div>
              <span>Якунланиш сана</span>
              <b>${dateValue(x.close_at)}</b>
            </div>
          </div>
        </section>

        <section class="xtd-section">
          <div class="xtd-title"><span>02</span> Буюртмачи</div>

          <div class="xtd-info-grid">
            <div class="wide">
              <span>Ташкилот</span>
              <b>${value(x.customer_name)}</b>
            </div>
            <div>
              <span>Компания ID</span>
              <b>${value(x.customer_company_id)}</b>
            </div>
          </div>
        </section>

        <section class="xtd-section xtd-full">
          <div class="xtd-title"><span>03</span> Лотлар</div>
          <div class="xtd-lots">${lotCards || "<div>Лотлар топилмади</div>"}</div>
        </section>

        <section class="xtd-section xtd-full">
          <div class="xtd-title">
            <span>04</span>
            Товар позициялари
            <small>${items.length} та</small>
          </div>

          <div class="xtd-items">
            ${itemCards || "<div>Позициялар топилмади</div>"}
          </div>
        </section>

        <div class="xtd-full" style="display:flex;justify-content:flex-end;margin-top:4px;">
          <a class="btn primary"
             href="${esc(sourceUrl)}"
             target="_blank"
             rel="noopener noreferrer">
             Манбада очиш ↗
          </a>
        </div>

      </div>
    </div>
  `;
}


async function openTenderDetail(market,tenderId,lotId){
  try{
    const url=
      `/api/tenders/active/detail?market=${market}`+
      `&tender_id=${tenderId}`+
      `&lot_id=${lotId}`;

    const d=await get(url);

    if(
      market==="xt_xarid" &&
      d.detail_type==="xt_xarid_rich" &&
      d.xt_xarid
    ){
      app.innerHTML=financeDetailNote(d)+renderXTXaridDetail(d);
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }


    if(
      market==="mc" &&
      d.detail_type==="mc_rich" &&
      d.mc
    ){
      app.innerHTML=financeDetailNote(d)+renderMCDetail(d);
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }


    if(
      market==="shaffof" &&
      d.detail_type==="shaffof_rich" &&
      d.shaffof
    ){
      app.innerHTML=financeDetailNote(d)+renderShaffofDetail(d);
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }


    if(
      market==="etender" &&
      d.detail_type==="etender_rich" &&
      d.etender
    ){
      app.innerHTML=financeEtenderNote(d)+renderEtenderDetail(d);
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }

    const positions=(d.positions||[]);

    app.innerHTML=`
      <div class="panel tender-detail-head">
        <button class="btn ghost" onclick="showTenderAnalytics()">
          ← Тендер аналитикаси
        </button>

        <div class="tender-detail-title">
          <small>${esc(d.market_title||d.market||"")}</small>
          <h2>${esc(d.tender_name||"Тендер")}</h2>
          <div class="tender-detail-lot">
            <span>ЛОТ №</span>
            <b>${esc(d.source_lot_id||"—")}</b>
            <small>Тендер ID: ${esc(d.source_tender_id||"—")}</small>
          </div>
        </div>
      </div>

      <div class="tender-detail-grid">
        <div class="panel">
          <small>ХАРИД ПРЕДМЕТИ</small>
          <h3>${esc(d.subject_group||"—")}</h3>
        </div>

        <div class="panel">
          <small>СОҲА</small>
          <h3>${esc(d.sector_group||"—")}</h3>
        </div>

        <div class="panel">
          <small>УМУМИЙ ҚИЙМАТ</small>
          <h3>${esc(financeMoney(d.source_tender_amount,d.currency))}</h3>
        </div>

        <div class="panel">
          <small>ПОЗИЦИЯЛАР</small>
          <h3>${num(d.positions_count||0)}</h3>
        </div>
      </div>

      <div class="panel tender-detail-info">
        <div><small>БУЮРТМАЧИ</small><b>${esc(d.customer_name||"—")}</b></div>
        <div><small>СТИР</small><b>${esc(d.customer_inn||"—")}</b></div>
        <div><small>ҲУДУД</small><b>${esc(d.region_name||"—")}</b></div>
        <div><small>СТАТУС</small><b>${esc(d.status||"—")}</b></div>
        <div><small>БОШЛАНИШ</small><b>${esc(d.start_date||"—")}</b></div>
        <div><small>ЯКУНЛАНИШ</small><b>${esc(d.end_date||"—")}</b></div>
      </div>

      <div class="panel table-panel">
        <div class="table-tools">
          <b>Товар / хизмат позициялари</b>
          <small>${num(positions.length)} та позиция</small>
        </div>

        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>НОМИ</th>
                <th>КОД</th>
                <th>МИҚДОР</th>
                <th>БИРЛИК</th>
                <th>БИРЛИК НАРХИ</th>
                <th>СУММА</th>
              </tr>
            </thead>
            <tbody>
              ${
                positions.length
                  ? positions.map((x,i)=>`
                    <tr>
                      <td>${i+1}</td>
                      <td><b>${esc(x.product_name||"—")}</b></td>
                      <td>${esc(x.product_code||"—")}</td>
                      <td>${x.quantity!=null ? num(x.quantity) : "—"}</td>
                      <td>${esc(x.unit_name||"—")}</td>
                      <td>${esc(financeMoney(x.unit_price,x.currency))}</td>
                      <td>${esc(financeMoney(x.amount,x.currency))}</td>
                    </tr>
                  `).join("")
                  : `<tr><td colspan="7">Позициялар мавжуд эмас</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      ${
        d.public_url
          ? `<div class="panel tender-source-link">
               <button class="btn primary"
                 onclick="window.open('${esc(d.public_url)}','_blank')">
                 Манбада кўриш ↗
               </button>
             </div>`
          : ""
      }
    `;

    window.scrollTo({top:0,behavior:"smooth"});

  }catch(e){
    app.innerHTML=`
      <div class="notice error">
        Тендер карточкасини очишда хатолик: ${esc(e.message)}
      </div>
    `;
  }
}

async function showDiagnostics(){setSourceContext("тизим диагностикаси • 9 та савдо йўналиши");current="diagnostics";navActive("diagnostics");title.textContent="Тизим диагностикаси";app.innerHTML='<div class="loading">Текширилмоқда…</div>';try{let h=await get("/api/system/health");app.innerHTML=`<div class="notice">bidata root: ${esc(h.uzbi_root)} • ${h.online}/${h.total} база online • ${h.elapsed_ms} ms</div><div class="diagnostic">${h.platforms.map(p=>`<div class="panel diag"><div class="diag-brand">${brandLogo(p.key,p)}</div><h3>${p.title}</h3><small class="platform-source-name">Маълумот манбаи: ${esc(p.source||p.title)}</small><p class="${p.exists?'ok':'bad'}">${p.exists?'● ONLINE':'● OFFLINE'}</p><code>${esc(p.path)}</code><p>${p.table?`Table: ${p.table} • ${num(p.rows)} rows • ${p.tables} tables`:''}</p>${p.error?`<div class="notice error">${esc(p.error)}</div>`:''}<button class="btn ghost" onclick="window.open('/api/${p.key}/schema','_blank')">Schema JSON</button></div>`).join('')}</div>`}catch(e){app.innerHTML=`<div class="notice error">${esc(e.message)}</div>`}}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{let k=b.dataset.key;if(k==="home")showHome();else if(k==="product_analytics")showProductAnalytics();else if(k==="market_analytics")showMarketAnalytics();else if(k==="tender_analytics")showTenderAnalytics();else if(k==="daily_digest")showDailyDigest();else if(k==="active")showActiveLots();else if(k==="diagnostics")showDiagnostics();else openPlatform(k)});
$("#hamb").onclick=()=>{const open=sidebar.classList.toggle("open");$("#hamb").setAttribute("aria-expanded",String(open))};$("#theme").onclick=()=>document.body.classList.toggle("dark");document.querySelectorAll("[data-density]").forEach(btn=>btn.onclick=()=>{
  const d=btn.dataset.density;
  document.body.classList.remove("compact","comfort","large");
  document.body.classList.add(d);
  localStorage.setItem("uzbi_density",d);
  document.querySelectorAll("[data-density]").forEach(x=>x.classList.toggle("active",x===btn));
});
const savedDensity=localStorage.getItem("uzbi_density")||"comfort";
document.body.classList.add(savedDensity);
document.querySelectorAll("[data-density]").forEach(x=>x.classList.toggle("active",x.dataset.density===savedDensity));

document.querySelectorAll('[data-nav-group]').forEach(group=>{const key='bidata_nav_'+group.dataset.navGroup;try{group.open=localStorage.getItem(key)==='open'}catch{}group.addEventListener('toggle',()=>{try{localStorage.setItem(key,group.open?'open':'closed')}catch{}})});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){sidebar.classList.remove('open');$('#hamb').setAttribute('aria-expanded','false')}});

bootstrap();


(function(){
  if(document.getElementById("bidata-auction-lot-final-style"))return;
  const st=document.createElement("style");
  st.id="bidata-auction-lot-final-style";
  st.textContent=`
    .auction-products-table .auction-col-category{
      min-width:160px;
      max-width:230px;
      white-space:normal !important;
      word-break:normal !important;
      overflow-wrap:break-word !important;
      line-height:1.45;
    }

    .auction-products-table .auction-col-desc{
      min-width:300px;
      max-width:460px;
      white-space:normal !important;
      word-break:normal !important;
      overflow-wrap:break-word !important;
      line-height:1.5;
      overflow:visible !important;
      text-overflow:clip !important;
      -webkit-line-clamp:unset !important;
    }

    .auction-products-table .auction-lot-total-row td{
      background:#eef7ff !important;
      border-top:2px solid #d8e8f5 !important;
      padding-top:16px !important;
      padding-bottom:16px !important;
      font-weight:800 !important;
    }

    .auction-products-table .auction-lot-total-row td:nth-child(2){
      font-size:18px !important;
      font-weight:900 !important;
    }

    .auction-products-table .auction-lot-grand-total{
      font-size:20px !important;
      font-weight:900 !important;
      white-space:nowrap !important;
    }
  `;
  document.head.appendChild(st);
})();









