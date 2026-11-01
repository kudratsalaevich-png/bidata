/* Isolated MC.UZ view. All dynamic strings and external links are escaped. */
async function mcTenderOpenPlatform(){
 const ep='/api/mc-view/v1';let tab='overview',page=0,serial=0,applied={},slice={},sliceName='';
 const tabs={overview:'Умумий',records:'Тендерлар',customers:'Буюртмачилар',winners:'Ғолиблар',regions:'Ҳудудлар',statuses:'Статуслар',types:'Иш турлари'};
 const exact=v=>v==null?'Маълумот йўқ':new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);

 const compact=v=>{if(v==null)return 'Маълумот йўқ';const n=Math.abs(v);const unit=n>=1e12?[1e12,'трлн']:n>=1e9?[1e9,'млрд']:n>=1e6?[1e6,'млн']:n>=1e3?[1e3,'минг']:null;return unit?new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v/unit[0])+' '+unit[1]:exact(v)};
 const shortDate=v=>v?String(v).replace(/^(\d{4})-(\d{2})-(\d{2})/,'$3.$2.$1'):'Маълумот йўқ';
 const month=v=>{if(!v)return 'Сана йўқ';const names=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];const m=String(v).match(/^(\d{4})-(\d{2})$/);return m?names[+m[2]-1]+' '+m[1]:v};
 function metric(label,value,kind='',caption='',amount=true){return `<article class="mc-metric ${kind}" title="${esc(amount?exact(value):value)}"><span class="mc-label">${esc(label)}</span><strong class="mc-value">${esc(amount?compact(value):value)}</strong>${amount?`<span class="mc-full">${esc(exact(value))}</span>`:''}${caption?`<span class="mc-caption">${esc(caption)}</span>`:''}</article>`}
 function monthlyChart(rows){
  const finite=v=>typeof v==='number'&&Number.isFinite(v);const dates=rows.filter(r=>r.period);if(!dates.length)return '<p class="mc-chart-note">Танланган даврда маълумот йўқ.</p>';
  const max=Math.max(0,...dates.flatMap(r=>[r.start_amount,r.completed_offer].filter(finite)));if(!max)return '<p class="mc-chart-note">Диаграмма учун мусбат қиймат мавжуд эмас. Аниқ суммалар жадвалда.</p>';
  const unit=max>=1e12?1e12:max>=1e9?1e9:max>=1e6?1e6:1;const unitLabel=unit===1e12?'трлн':unit===1e9?'млрд':unit===1e6?'млн':'бирлик';
  const peak=Math.ceil(max/unit*1.12);const W=Math.max(680,dates.length*68),H=285,left=62,right=16,top=20,bottom=52,height=H-top-bottom,width=W-left-right,step=width/dates.length,bw=Math.min(22,step*.29);let svg='';
  for(let i=0;i<=4;i++){const v=peak*i/4,y=H-bottom-(v/peak)*height;svg+=`<line x1="${left}" x2="${W-right}" y1="${y}" y2="${y}"/><text x="${left-10}" y="${y+4}" text-anchor="end">${esc(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(v))}</text>`}
  dates.forEach((r,i)=>{const cx=left+step*(i+.5);for(const [key,dx,cls,label] of [['start_amount',-bw-2,'mc-bar-start','Бошланғич қиймат'],['completed_offer',2,'mc-bar-offer','Якунланган ғолиб нархи']]){const value=r[key];if(!finite(value)){svg+=`<text x="${cx+dx+bw/2}" y="${H-bottom-5}" text-anchor="middle"><title>${esc(month(r.period))}: ${esc(label)} — маълумот йўқ</title>—</text>`;continue}const h=Math.max(0,value/unit/peak*height);svg+=`<rect class="${cls}" x="${cx+dx}" y="${H-bottom-h}" width="${bw}" height="${h}" rx="4"><title>${esc(month(r.period))}: ${esc(label)} — ${esc(exact(value))}</title></rect>`}svg+=`<text x="${cx}" y="${H-bottom+24}" text-anchor="middle">${esc(month(r.period).slice(0,3))}</text><text x="${cx}" y="${H-bottom+40}" text-anchor="middle">${esc(String(r.period).slice(0,4))}</text>`});
  return `<div class="mc-chart-scroll"><svg class="mc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ойлик бошланғич қиймат ва якунланган ғолиб нархи, ${esc(unitLabel)}"><text x="10" y="14">${esc(unitLabel)}</text>${svg}</svg></div><p class="mc-chart-note">Суммалар UZS — сўмда. Устун устида аниқ қиймат кўринади. «—» маълумот йўқлигини билдиради.</p>`;
 }
 const dt=v=>{if(!v)return 'Маълумот йўқ';let text=String(v);if(/(Z|[+-]\d\d:\d\d)$/.test(text)){const d=new Date(text);if(!isNaN(d))return new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Tashkent',dateStyle:'short',timeStyle:'short'}).format(d)}return text.replace(/^(\d{4})-(\d{2})-(\d{2})/,'$3.$2.$1').replace('T',' ').replace(/(\d{2}:\d{2}:\d{2})\.\d+/,'$1')};
 const dateFields=new Set(['created_at','confirmed_date','winner_determined_date','placement_term','end_term_work','discussion_start_date','discussion_end_date','list_synced_at','detail_synced_at']);
 const amounts=new Set(['start_price','winner_offer','saving_amount','saving_pct','required_percent_amount','required_percent','winner_rating']);
 const cell=(k,v)=>esc(dateFields.has(k)?dt(v):amounts.has(k)?exact(v):v??'Маълумот йўқ');
 const alive=()=>current==='mc'&&document.contains(root);
 app.innerHTML=`<style>
#mcView{--mc-ink:var(--text,#172d46);--mc-muted:var(--muted,#66768c);--mc-bg:var(--panel,#fff);--mc-edge:var(--line,#e2e9ef);--mc-teal:#089c83;--mc-blue:#326fb5;color:var(--mc-ink);font:inherit;min-width:0}
#mcView *{box-sizing:border-box}#mcView .mc-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px}
#mcView .mc-brand{display:flex;gap:12px;align-items:center}#mcView .mc-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:#e5f6f1;color:#057662;font-size:22px;font-weight:800}
#mcView .mc-brand h2{font-size:19px;line-height:1.3;margin:0 0 4px}#mcView .mc-brand p{margin:0;color:var(--mc-muted);font-size:12px}
#mcView .mc-tag{padding:7px 11px;border:1px solid var(--mc-edge);border-radius:999px;font-size:11px;color:var(--mc-muted);white-space:nowrap}
#mcView .inner-tabs{display:flex;flex-wrap:wrap;gap:5px;padding:5px;border:1px solid var(--mc-edge);border-radius:13px;background:var(--mc-bg);width:fit-content;max-width:100%;margin-bottom:18px}
#mcView .inner-tabs .btn{border:0;background:transparent;color:var(--mc-muted);font-size:13px;border-radius:9px;padding:10px 16px;box-shadow:none}
#mcView .inner-tabs .btn.active{background:#07947d;color:#fff}#mcView .inner-tabs .btn:hover:not(.active){background:#edf5f4;color:#116957}
#mcView .filters{display:grid;grid-template-columns:minmax(155px,1.1fr) minmax(125px,.85fr) minmax(125px,.85fr) minmax(165px,1.2fr) minmax(165px,1.25fr) minmax(155px,1.1fr);gap:16px;padding:20px;border:1px solid var(--mc-edge);border-radius:16px;background:var(--mc-bg);box-shadow:0 5px 20px #18334e04;margin:0 0 14px}
#mcView .filters>div{min-width:0}#mcView label{display:block;font-size:12px;font-weight:600;color:var(--mc-muted);margin-bottom:7px}
#mcView input,#mcView select{font:inherit;font-size:13px;width:100%;min-width:0;max-width:none;height:42px;padding:9px 11px;border:1px solid var(--mc-edge);border-radius:9px;background:var(--mc-bg);color:inherit}
#mcView input:focus,#mcView select:focus{outline:2px solid #17a88b44;outline-offset:1px}#mcView .mc-search{grid-column:1/4}
#mcView .mc-filter-buttons{grid-column:4/7;display:flex;align-items:end;justify-content:flex-end;gap:8px;flex-wrap:wrap}
#mcView .btn{min-height:40px;padding:9px 15px;font-size:13px;white-space:nowrap}#mcView .mc-context{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:14px 0 18px;color:var(--mc-muted);font-size:12px}
#mcView .mc-context:before{content:'';height:6px;width:6px;border-radius:50%;background:#099c82}#mcView .mc-context .btn{min-height:30px;padding:5px 10px;font-size:12px}
#mcView .mc-primary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
#mcView .mc-metric{min-width:0;border:1px solid var(--mc-edge);border-radius:15px;background:var(--mc-bg);padding:20px;position:relative;overflow:hidden}
#mcView .mc-metric.mc-featured{background:#112f49;color:#fff;border-color:#112f49}#mcView .mc-metric.mc-featured .mc-label,#mcView .mc-metric.mc-featured .mc-full,#mcView .mc-metric.mc-featured .mc-caption{color:#b9d5e0}
#mcView .mc-label{font-size:12px;line-height:1.5;font-weight:600;color:var(--mc-muted);min-height:36px;display:block}
#mcView .mc-value{font-size:clamp(23px,2.3vw,34px);font-weight:750;line-height:1.25;letter-spacing:-.5px;display:block;margin:8px 0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
#mcView .mc-full{font-size:11px;color:var(--mc-muted);overflow-wrap:anywhere;line-height:1.5;display:block;margin:3px 0 0;font-variant-numeric:tabular-nums}
#mcView .mc-caption{font-size:11px;color:var(--mc-muted);margin-top:10px;display:block;line-height:1.5}
#mcView .mc-metric.mc-green .mc-value{color:#07806d}#mcView .mc-secondary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:18px}
#mcView .mc-secondary-grid .mc-metric{padding:15px}#mcView .mc-secondary-grid .mc-value{font-size:21px;letter-spacing:0;margin:5px 0}#mcView .mc-secondary-grid .mc-label{font-size:11px;min-height:34px}
#mcView .notice{margin:12px 0;padding:14px 16px;border:1px solid var(--mc-edge);border-radius:12px;background:var(--mc-bg);font-size:12px;line-height:1.65;color:var(--mc-muted)}
#mcView .mc-notes{border:1px solid var(--mc-edge);border-radius:12px;background:var(--mc-bg);margin:0 0 22px;padding:0 16px;color:var(--mc-muted);font-size:12px;line-height:1.65}
#mcView .mc-notes summary{padding:12px 0;cursor:pointer;font-weight:600;color:var(--mc-ink)}#mcView .mc-notes p{margin:0 0 12px}
#mcView .mc-chart-card{border:1px solid var(--mc-edge);border-radius:16px;background:var(--mc-bg);padding:22px;margin-bottom:22px}
#mcView .mc-section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}#mcView h3{font-size:16px;margin:16px 0;color:var(--mc-ink)}#mcView .mc-section-head h3{margin:0}
#mcView .mc-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:var(--mc-muted)}#mcView .mc-legend span{display:flex;gap:6px;align-items:center}#mcView .mc-dot{width:9px;height:9px;border-radius:3px;background:#326fb5;display:inline-block}#mcView .mc-dot.green{background:#0a9b83}
#mcView .mc-chart-scroll{overflow:auto}#mcView .mc-chart{width:100%;min-width:680px;max-height:320px;display:block;color:var(--mc-muted)}#mcView .mc-chart text{font:11px Arial,sans-serif;fill:currentColor}#mcView .mc-chart line{stroke:var(--mc-edge)}#mcView .mc-chart .mc-bar-start{fill:#326fb5}#mcView .mc-chart .mc-bar-offer{fill:#0a9b83}#mcView .mc-chart-note{font-size:11px;color:var(--mc-muted);margin:8px 0 0;line-height:1.6}
#mcView .scroll{overflow:auto;max-height:65vh;padding:0;border:1px solid var(--mc-edge);border-radius:14px;background:var(--mc-bg)}
#mcView table{width:100%;min-width:820px;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}#mcView th,#mcView td{padding:14px 16px;border-bottom:1px solid var(--mc-edge);text-align:left;vertical-align:middle}
#mcView th{position:sticky;top:0;background:var(--mc-bg);color:var(--mc-muted);font-size:11px;font-weight:650;z-index:1}#mcView td{max-width:400px;white-space:normal;line-height:1.5}#mcView tbody tr:hover{background:#edf8f540}#mcView tbody tr:last-child td{border-bottom:0}
#mcView .mc-month-table td:not(:first-child),#mcView .mc-month-table th:not(:first-child){text-align:right;white-space:nowrap}#mcView .mc-month-table td:first-child{font-weight:600}
#mcView .actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:15px 0;color:var(--mc-muted);font-size:12px}
#mcView .link{background:none;border:0;color:#07836d;text-decoration:none;cursor:pointer;font:inherit;font-weight:600;text-align:left}#mcView .link:hover{text-decoration:underline}
#mcView .modal{position:fixed;inset:0;background:#071c34a0;backdrop-filter:blur(3px);display:grid;place-items:center;z-index:1000;padding:20px}
#mcView .dialog{background:var(--mc-bg);padding:26px;border-radius:18px;width:min(1180px,96vw);max-height:90vh;overflow:auto;box-shadow:0 20px 70px #0004}
#mcView .dialog .kv{min-width:0}#mcView .kv th{position:static;width:250px}#mcView .kv td{overflow-wrap:anywhere}#mcView #mcFiles p{padding:12px 14px;border:1px solid var(--mc-edge);border-radius:9px;font-size:12px}#mcView #mcFiles a{overflow-wrap:anywhere;color:#07836d}
body.dark #mcView{--mc-ink:#e0e9f3;--mc-muted:#a5b8cb;--mc-bg:#102b42;--mc-edge:#2c455b}body.dark #mcView .mc-mark{background:#143f41;color:#53d4b4}body.dark #mcView .mc-metric.mc-green .mc-value{color:#55d9bd}body.dark #mcView .link,body.dark #mcView #mcFiles a{color:#55d9bd}
@media(max-width:1200px){#mcView .filters{grid-template-columns:repeat(3,minmax(0,1fr))}#mcView .mc-search{grid-column:1/3}#mcView .mc-filter-buttons{grid-column:3/4}#mcView .mc-secondary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:900px){#mcView .mc-primary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#mcView .mc-filter-buttons{grid-column:1/4;justify-content:flex-start}#mcView .mc-search{grid-column:1/4}}
@media(max-width:560px){#mcView .mc-top{align-items:flex-start}#mcView .mc-tag{display:none}#mcView .filters{grid-template-columns:repeat(2,minmax(0,1fr));padding:14px;gap:12px}#mcView .mc-search,#mcView .mc-filter-buttons{grid-column:1/3}#mcView .mc-filter-buttons{justify-content:flex-start}#mcView .mc-primary-grid,#mcView .mc-secondary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#mcView .mc-metric{padding:14px}#mcView .mc-value{font-size:24px}#mcView .mc-secondary-grid .mc-value{font-size:19px}#mcView .mc-label{font-size:11px}#mcView .inner-tabs .btn{padding:9px 12px}#mcView .mc-chart-card{padding:15px}#mcView .dialog{padding:16px}#mcView .kv th{width:140px}}

#mcView .dialog.mc-detail-dialog{padding:0;overflow:hidden;display:flex;flex-direction:column;width:min(1240px,96vw);max-height:92vh}
#mcView .mc-detail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-bottom:1px solid var(--mc-edge);flex:none;background:var(--mc-bg)}
#mcView .mc-detail-toolbar strong{font-size:15px}#mcView #mcDetails{overflow:auto;padding:18px 20px;min-height:0}
#mcView .mc-detail-title{font-size:18px;line-height:1.45;margin:0 0 12px;overflow-wrap:anywhere}
#mcView .mc-detail-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}#mcView .mc-detail-badge{font-size:12px;padding:6px 10px;border:1px solid var(--mc-edge);border-radius:8px;background:var(--mc-bg);line-height:1.4}
#mcView .mc-detail-badge b{color:var(--mc-muted);font-weight:500;margin-right:5px}
#mcView .mc-detail-money{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
#mcView .mc-detail-money article{padding:13px 15px;border:1px solid var(--mc-edge);border-radius:12px;background:var(--mc-bg)}#mcView .mc-detail-money article:first-child{border-top:3px solid var(--mc-blue)}#mcView .mc-detail-money article:nth-child(2){border-top:3px solid var(--mc-teal)}
#mcView .mc-detail-money span{display:block;font-size:11px;color:var(--mc-muted);margin-bottom:6px}#mcView .mc-detail-money strong{display:block;font-size:20px;line-height:1.4;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}#mcView .mc-detail-money small{display:block;font-size:12px;color:var(--mc-muted);margin-top:5px}
#mcView .mc-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;margin-bottom:12px}
#mcView .mc-detail-card{border:1px solid var(--mc-edge);border-radius:12px;padding:12px 14px;min-width:0}#mcView .mc-detail-card h3{font-size:13px;margin:0 0 7px;color:var(--mc-teal)}
#mcView .mc-detail-list{margin:0}#mcView .mc-detail-row{display:grid;grid-template-columns:minmax(115px,36%) minmax(0,1fr);gap:12px;padding:6px 0;border-top:1px solid var(--mc-edge);font-size:12px;line-height:1.45}
#mcView .mc-detail-row dt{color:var(--mc-muted)}#mcView .mc-detail-row dd{margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}#mcView .mc-detail-missing{color:var(--mc-muted)}
#mcView .mc-detail-section{border:1px solid var(--mc-edge);border-radius:12px;padding:0 14px;margin:10px 0;font-size:12px;line-height:1.5}#mcView .mc-detail-section>summary{padding:12px 0;cursor:pointer;font-weight:650}#mcView .mc-detail-section[open]>summary{border-bottom:1px solid var(--mc-edge);margin-bottom:10px}#mcView .mc-detail-section .scroll{max-height:260px;margin-bottom:12px}#mcView .mc-detail-section th,#mcView .mc-detail-section td{padding:9px 12px}#mcView .mc-detail-section p{margin:0 0 12px}
#mcView #mcFiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}#mcView #mcFiles p{margin:0;padding:9px 11px;line-height:1.5}
body.dark #mcView .mc-detail-card h3{color:#55d9bd}
@media(max-width:760px){#mcView .mc-detail-grid{grid-template-columns:1fr}#mcView .mc-detail-money strong{font-size:16px}#mcView #mcDetails{padding:14px}#mcView .mc-detail-toolbar{padding:10px 14px}}
@media(max-width:520px){#mcView .mc-detail-money,#mcView #mcFiles{grid-template-columns:1fr}#mcView .mc-detail-title{font-size:16px}#mcView .mc-detail-row{grid-template-columns:105px minmax(0,1fr);gap:8px}#mcView .modal{padding:8px}#mcView .dialog.mc-detail-dialog{width:100%;max-height:96vh}}
</style><div id="mcView">Юкланмоқда…</div>`;
 const root=app.querySelector('#mcView');let meta;
 try{meta=await get(ep+'/meta')}catch(e){if(alive())root.textContent=e.message;return}if(!alive())return;
 const options=(rows,missing=false)=>rows.map(r=>`<option value="${r.code==null?'missing':esc(r.code)}">${esc(r.name||'Маълумот йўқ')} (${esc(r.code??'бўш')})</option>`).join('');
 const span=meta.dates.confirmed;const last=span.max_date||new Date().toISOString().slice(0,10);
 root.innerHTML=`<div class="mc-top"><div class="mc-brand"><span class="mc-mark">M</span><div><h2>Тендерлар таҳлили</h2><p>MC.UZ · ${num(meta.rows)} тендер · ${esc(shortDate(span.min_date))} — ${esc(shortDate(span.max_date))}</p></div></div><span class="mc-tag">Суммалар UZS — сўмда</span></div><div class="inner-tabs">${Object.entries(tabs).map(([k,v])=>`<button data-tab="${k}" class="btn ghost">${v}</button>`).join('')}</div><div class="panel filters"><div><label>Сана тури</label><select id="mcBasis">${Object.entries(meta.date_labels).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></div><div><label>Дан</label><input type="date" id="mcFrom" value="${last.slice(0,4)}-01-01"></div><div><label>Гача</label><input type="date" id="mcTo" value="${last}"></div><div><label>Тендер статуси</label><select id="mcStatus"><option value="">Барчаси</option>${options(meta.statuses)}</select></div><div><label>Шартнома статуси</label><select id="mcContract"><option value="">Барчаси</option>${options(meta.contracts)}</select></div><div><label>Объект ҳудуди</label><select id="mcRegion"><option value="">Барчаси</option>${options(meta.regions)}</select></div><div class="mc-search"><label>Қидириш</label><input id="mcQ" placeholder="Тендер, ташкилот, СТИР, рақам"></div><div class="mc-filter-buttons"><button class="btn primary" id="mcApply">Қўллаш</button><button class="btn ghost" id="mcAll">Барча давр</button><button class="btn ghost" id="mcClear">Тозалаш</button></div></div><div class="mc-context" id="mcContext"></div><div id="mcBody"></div><div id="mcModal"></div>`;
 const el=id=>root.querySelector('#'+id);
 const read=()=>({date_basis:el('mcBasis').value,date_from:el('mcFrom').value,date_to:el('mcTo').value,status:el('mcStatus').value,contract:el('mcContract').value,region:el('mcRegion').value,q:el('mcQ').value.trim()});
 const query=x=>new URLSearchParams({...applied,...slice,...x}).toString();
 const table=(heads,rows)=>`<div class="panel scroll"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}">Фильтрга мос натижа йўқ</td></tr>`}</tbody></table></div>`;
 function setTab(k){tab=k;page=0;root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===k))}
 function detailContent(d,id){
  const t=d.tender,labels=d.labels,used=new Set();
  const has=k=>Object.prototype.hasOwnProperty.call(labels,k);
  const value=k=>cell(k,t[k]);
  const take=k=>{if(!has(k))return '';used.add(k);return value(k)};
  const row=k=>{if(!has(k)||used.has(k))return '';used.add(k);return `<div class="mc-detail-row" data-field="${esc(k)}"><dt>${esc(labels[k])}</dt><dd${t[k]==null?' class="mc-detail-missing"':''}>${value(k)}</dd></div>`};
  const group=(title,keys)=>{const rows=keys.map(row).join('');return rows?`<section class="mc-detail-card"><h3>${esc(title)}</h3><dl class="mc-detail-list">${rows}</dl></section>`:''};
  const title=has('name')?`<h2 class="mc-detail-title" data-field="name">${take('name')}</h2>`:'';
  const badges=['status_name','contract_status_name','unique_name','currency'].filter(has).map(k=>`<span class="mc-detail-badge" data-field="${k}"><b>${esc(labels[k])}</b>${take(k)}</span>`).join('');
  const money=['start_price','winner_offer','saving_amount'].filter(has).map(k=>`<article data-field="${k}"><span>${esc(labels[k])} · ${esc(t.currency??'Валюта кўрсатилмаган')}</span><strong>${take(k)}</strong>${k==='saving_amount'&&has('saving_pct')?`<small data-field="saving_pct">${esc(labels.saving_pct)}: ${take('saving_pct')}${t.saving_pct==null?'':'%'}</small>`:''}</article>`).join('');
  const groups=[
   ['Буюртмачи ва ғолиб',['customer_name','customer_inn','winner_name','winner_inn','winner_id','bidders_count']],
   ['Саналар ва муддатлар',['confirmed_date','created_at','placement_term','winner_determined_date','end_term_work','end_term_work_days','discussion_start_date','discussion_end_date']],
   ['Объект ва манзил',['region','district','address','object_type','service_type','lot_type_name','complexity_category','category_score']],
   ['Молиялаштириш ва талаблар',['financial_source','dastur','soxa','with_nds','required_percent','required_percent_amount','asos','resolution']],
   ['Консалтинг ва ғолиб рейтинги',['consulting_name','consulting_inn','winner_rating','winner_rating_title','winner_region']],
   ['Рақамлар ва маълумот янгиланиши',['id','gnk_id','status_code','contract_status_code','latitude','longitude','list_synced_at','detail_synced_at','detail_error']]
  ].map(([title,keys])=>group(title,keys)).join('');
  const remaining=group('Қўшимча маълумотлар',Object.keys(labels).filter(k=>!used.has(k)));
  return `${title}<div class="mc-detail-badges">${badges}</div><div class="mc-detail-money">${money}</div><div class="mc-detail-grid">${groups}${remaining}</div>
   <details class="mc-detail-section"><summary>Ҳужжатлар · ${num(d.files.length)}</summary><div id="mcFiles"></div></details>
   <details class="mc-detail-section"><summary>Тендер позициялари · ${num(d.items.length)}</summary>${table(['Маҳсулот / иш','Миқдор','Ўлчов бирлиги','Бирлик нархи','Жами'],d.items.map(r=>`<tr><td>${esc(r.product_name??'Маълумот йўқ')}</td><td>${exact(r.quantity)}</td><td>${esc(r.unit_name??'Маълумот йўқ')}</td><td>${exact(r.unit_price)}</td><td>${exact(r.total_price)}</td></tr>`).join(''))}</details>
   <details class="mc-detail-section"><summary>Базада кузатилган статуслар тарихи · ${num(d.process.length)}</summary>${table(['Статус коди','Кузатилган сана','Тугаш санаси'],d.process.map(r=>`<tr><td>${esc(r.action)}</td><td>${esc(dt(r.created_at))}</td><td>${esc(dt(r.end_date))}</td></tr>`).join(''))}</details>
   <details class="mc-detail-section"><summary>Ҳисоблаш изоҳи</summary><p>${esc(d.note)}</p></details>`;
 }
 async function detail(id){
  const modal=el('mcModal');modal.innerHTML=`<div class="modal"><div class="dialog mc-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="mcDetailHeading"><div class="mc-detail-toolbar"><strong id="mcDetailHeading">Тендер № ${esc(id)}</strong><button class="btn ghost" id="mcClose">Ёпиш ×</button></div><div id="mcDetails">Юкланмоқда…</div></div></div>`;
  const details=el('mcDetails');el('mcClose').focus();modal.onkeydown=e=>{if(e.key==='Escape')modal.innerHTML=''};modal.querySelector('.modal').onclick=e=>{if(e.target.classList.contains('modal'))modal.innerHTML=''};el('mcClose').onclick=()=>{modal.innerHTML=''};
  try{const d=await get(ep+'/detail/'+encodeURIComponent(id));if(!alive()||!document.contains(details))return;
   details.innerHTML=detailContent(d,id);
   const files=el('mcFiles');if(!d.files.length)files.textContent='Ҳужжатлар қайд этилмаган';
   d.files.forEach(r=>{const p=document.createElement('p');const kinds={contract_file:'Шартнома файли',consulting_files:'Консалтинг ҳужжати',protocol_file:'Баённома',dalolatnoma:'Далолатнома',dalolatnoma_file:'Далолатнома'};p.textContent=(r.source_kind?(kinds[r.source_kind]||'Ҳужжат')+' • ':'');try{const u=new URL(r.file_url);if(!['https:','http:'].includes(u.protocol))throw Error();const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=r.file_name||r.file_type||'Ҳужжатни очиш';p.append(a)}catch{p.append(document.createTextNode((r.file_name||'Ҳужжат')+' — ҳавола мавжуд эмас'))}files.append(p)})
  }catch(e){if(document.contains(details))details.textContent=e.message}
 }
 async function exportFile(format){try{const r=await fetch(ep+'/export?'+query({format}));if(!r.ok){const d=await r.json();throw Error(d.detail||r.status)}const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download='mc_tenders.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}catch(e){alert(e.message)}}
 async function load(){
  const ticket=++serial;const chosenSpan=meta.dates[applied.date_basis];
  el('mcContext').innerHTML=`${esc(meta.date_labels[applied.date_basis])}: ${applied.date_from?esc(shortDate(applied.date_from)):'бошидан'} — ${applied.date_to?esc(shortDate(applied.date_to)):'охиригача'} • ${esc(sliceName)} ${Object.keys(slice).length?'<button id="mcBack" class="btn ghost">Кесимдан чиқиш</button>':''}`;
  if(el('mcBack'))el('mcBack').onclick=()=>{slice={};sliceName='';page=0;load()};el('mcBody').textContent='Ҳисобланмоқда…';
  try{const d=await get(ep+'/data?'+query({view:tab,offset:page*50}));if(!alive()||ticket!==serial)return;const b=el('mcBody'),s=d.summary;
   const note=`<div class="notice">${esc(d.note)} ${num(chosenSpan.missing)} та тендерда танланган сана тури йўқ; сана чегараси қўйилса улар чиқмайди.</div>`;
   if(tab==='overview'){
    const main=[metric('Барча бошланғич қиймат',s.start_amount,'mc-featured','Танланган фильтрдаги барча статуслар'),metric('Якунланган ғолиб нархи',s.completed_offer,'','Ғолиб нархи бор: '+num(s.completed_priced)+' та'),metric('Якунланганларда тежам',s.completed_saving,'mc-green','Ғолиб нархи мавжуд якунланган тендерлар'),metric('Жами тендерлар',num(s.tenders),'','Танланган сана ва фильтрлар бўйича',false)];
    const secondary=[metric('Якунланган тендерлар',num(s.completed),'','',false),metric('Буюртмачилар · СТИР',num(s.customers),'','',false),metric('Якунланган ғолиблар · СТИР',num(s.completed_winners),'','',false),metric('Шартномаси тасдиқланган',num(s.approved_contracts),'','',false),metric('Тасдиқланганларда ғолиб нархи',s.approved_offer),metric('Тежам · вазнли фоиз',s.completed_saving_pct==null?'Маълумот йўқ':exact(s.completed_saving_pct)+'%','mc-green','',false)];
    b.innerHTML=`<div class="mc-primary-grid">${main.join('')}</div><div class="mc-secondary-grid">${secondary.join('')}</div><details class="mc-notes"><summary>Ҳисоблаш изоҳлари · ${num(s.completed_priced)} / ${num(s.completed)} якунланган тендерда ғолиб нархи бор</summary><p>${esc(d.note)}</p><p>${num(chosenSpan.missing)} та тендерда танланган сана тури йўқ. Сана чегараси қўйилганда улар ҳисобга кирмайди. Тежам фоизи ғолиб нархи мавжуд якунланган ёзувларнинг бошланғич қиймати асосида ҳисобланади.</p><p>Барча статуслардаги ғолиб таклифлари: ${exact(s.offer_amount)} (${num(s.priced)} та). Бу сумма муҳокамадаги ёзувларни ҳам қамраши мумкин.</p></details><section class="mc-chart-card"><div class="mc-section-head"><h3>Ойлик динамика</h3><div class="mc-legend"><span><i class="mc-dot"></i>Бошланғич қиймат</span><span><i class="mc-dot green"></i>Якунланган ғолиб нархи</span></div></div>${monthlyChart(d.monthly)}</section><div class="mc-section-head"><h3>Ойлар бўйича аниқ ҳисоблар</h3><span class="mc-tag">${esc(meta.date_labels[applied.date_basis])}</span></div><div class="mc-month-table">${table(['Ой','Тендерлар','Бошланғич қиймат','Якунланган ғолиб нархи','Якунланганларда тежам'],d.monthly.map(r=>`<tr><td>${esc(month(r.period))}</td><td>${num(r.tenders)}</td><td>${exact(r.start_amount)}</td><td>${exact(r.completed_offer)}</td><td>${exact(r.completed_saving)}</td></tr>`).join(''))}</div>`;
   }else if(tab==='records'){
    const fields=['id','unique_name','name','confirmed_date','start_price','winner_offer','saving_amount','customer_name','customer_inn','winner_name','winner_inn','region','status_name','status_code','contract_status_name'];
    b.innerHTML=`${note}<div class="actions">Жами ${num(s.tenders)} та; ${s.tenders?page*50+1:0}–${page*50+d.rows.length}<button id="mcPrev" class="btn ghost" ${page===0?'disabled':''}>←</button><button id="mcNext" class="btn ghost" ${(page+1)*50>=s.tenders?'disabled':''}>→</button><button id="mcExcel" class="btn ghost">Excel</button><button id="mcCsv" class="btn primary">CSV</button></div>${table(fields.map(k=>d.labels[k]),d.rows.map(r=>'<tr>'+fields.map(k=>`<td>${k==='id'?`<button class="link" data-id="${esc(r.id)}">${esc(r.id)}</button>`:cell(k,r[k])}</td>`).join('')+'</tr>').join(''))}`;
    el('mcPrev').onclick=()=>{page--;load()};el('mcNext').onclick=()=>{page++;load()};el('mcExcel').onclick=()=>exportFile('xlsx');el('mcCsv').onclick=()=>exportFile('csv');b.querySelectorAll('[data-id]').forEach(x=>x.onclick=()=>detail(x.dataset.id));
   }else{
    const isWinner=tab==='winners';const hs=[tabs[tab],tab==='customers'||isWinner?'СТИР':'Код','Тендерлар','Бошланғич қиймат','Якунланган ғолиб нархи','Якунланганларда тежам'];
    b.innerHTML=`${note}<h3>${tabs[tab]} — TOP ${d.groups.length} / ${num(d.group_count)}</h3>${isWinner?'<div class="notice">Ғолиблар кесими фақат якунланган (5) тендерларни қамрайди.</div>':''}${table(hs,d.groups.map((r,i)=>`<tr><td><button class="link" data-slice="${i}">${esc(r.name||'Маълумот йўқ')}</button></td><td>${esc(r.id??'Маълумот йўқ')}</td><td>${num(r.tenders)}</td><td>${exact(r.start_amount)}</td><td>${exact(r.completed_offer)}</td><td>${exact(r.completed_saving)}</td></tr>`).join(''))}`;
    b.querySelectorAll('[data-slice]').forEach(x=>x.onclick=()=>{const r=d.groups[+x.dataset.slice];if(r.id==null)return;const key={customers:'customer',winners:'winner',regions:'region',statuses:'status',types:'lot_type'}[tab];slice={[key]:r.id,...(isWinner?{cohort:'completed'}:{})};sliceName=tabs[tab]+': '+(r.name||'Маълумот йўқ')+' • '+r.id;setTab('records');load()});
   }
  }catch(e){if(alive()&&ticket===serial)el('mcBody').textContent=e.message}
 }
 root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{slice={};sliceName='';setTab(b.dataset.tab);load()});
 el('mcApply').onclick=()=>{applied=read();slice={};sliceName='';page=0;load()};el('mcQ').onkeydown=e=>{if(e.key==='Enter')el('mcApply').click()};
 el('mcAll').onclick=()=>{el('mcFrom').value='';el('mcTo').value='';el('mcApply').click()};
 el('mcClear').onclick=()=>{el('mcBasis').value='confirmed';el('mcFrom').value=last.slice(0,4)+'-01-01';el('mcTo').value=last;el('mcStatus').value='';el('mcContract').value='';el('mcRegion').value='';el('mcQ').value='';el('mcApply').click()};
 applied=read();setTab('overview');await load();
}
