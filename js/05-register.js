/* ============================================================
   IGL BBS · 05-register.js
   Observation register, detail modal, print & exports
   ============================================================ */

/* ================= Observation Register ================= */
function renderRegister(){
  const V = $('#view-register'); V.textContent='';
  const f = S.regF;
  S.regState = S.regState || { sort:{key:'date', dir:'desc'}, page:1, sel:new Set() };
  const st = S.regState;

  V.append(h('div',{class:'filters'},
    fWrap('Search', h('input',{type:'search', placeholder:'ID, observer, location, job…', value:f.q, oninput:e=>{S.regF.q=e.target.value; st.page=1; draw();}})),
    fWrap('Department', selEl(S.set.departments, f.dept, v=>{S.regF.dept=v; st.page=1; draw();}, 'All')),
    fWrap('Plant', selEl(S.set.plants, f.plant, v=>{S.regF.plant=v; st.page=1; draw();}, 'All')),
    fWrap('From', h('input',{type:'date', value:f.from, onchange:e=>{S.regF.from=e.target.value; st.page=1; draw();}})),
    fWrap('To', h('input',{type:'date', value:f.to, onchange:e=>{S.regF.to=e.target.value; st.page=1; draw();}})),
    h('div',{style:'flex:1'}),
    h('div',{class:'f'}, h('label',{},'Export / import'),
      h('div',{style:'display:flex;gap:7px;flex-wrap:wrap'},
        h('button',{class:'btn sm', onclick:()=>exportRegisterXlsx()},'⬇ Excel'),
        h('button',{class:'btn sm', onclick:()=>exportRegisterCsv()},'⬇ CSV'),
        h('button',{class:'btn sm', onclick:()=>exportBackup()},'⬇ Backup'),
        importBtn()))
  ));
  const db = demoBar(); if (db) V.append(db);
  const mount = h('div',{}); V.append(mount);
  st.rerender = draw;

  function draw(){
    mount.textContent='';
    const list = filterObs({q:S.regF.q, dept:S.regF.dept, plant:S.regF.plant, from:S.regF.from, to:S.regF.to});
    /* keep selection to what is visible */
    st.sel = new Set([...st.sel].filter(id=>list.some(o=>o.id===id)));

    const head = h('div',{style:'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px'});
    head.append(h('span',{class:'note'}, fmtN(list.length)+' observation(s)'));
    if (S.obs.length && !list.length) head.append(h('button',{class:'btn sm ghost', onclick:()=>{ S.regF={q:'',dept:'',plant:'',from:'',to:''}; renderRegister(); }},'Clear filters'));
    mount.append(head);

    if (st.sel.size){
      mount.append(h('div',{class:'bulkbar'},
        h('b',{}, fmtN(st.sel.size)+' selected'),
        h('span',{class:'grow', style:'flex:1'}),
        h('button',{class:'btn sm', onclick:()=>{ const rows=[...st.sel]; S.regF.__bulk=rows; exportSelectedXlsx(rows); }},'⬇ Export selected'),
        h('button',{class:'btn sm', onclick:()=>{ st.sel=new Set(); draw(); }},'Clear selection'),
        h('button',{class:'btn sm danger', onclick:()=>{
          const ids=[...st.sel];
          if (!confirm('Delete '+ids.length+' observation(s) and their linked actions?')) return;
          const snapO = S.obs.slice(), snapA = S.actions.slice();
          S.obs = S.obs.filter(o=>!st.sel.has(o.id));
          S.actions = S.actions.filter(a=>!st.sel.has(a.obsId));
          st.sel = new Set(); saveObs(); saveAct(); updateCounts(); draw();
          toastUndo(ids.length+' observation(s) deleted', ()=>{ S.obs=snapO; S.actions=snapA; saveObs(); saveAct(); updateCounts(); draw(); });
        }},'🗑 Delete selected')));
    }

    if (!list.length){ mount.append(h('div',{class:'card empty'},
      h('div',{class:'big'},'🔍'), h('h4',{},'No observations match'),
      h('p',{},'Try widening the date range or clearing a filter.'),
      ...(S.obs.length? [] : [h('button',{class:'btn primary', onclick:()=>loadDemo(60)},'🎲 Load demo data')]))); return; }

    const cols = [
      {key:'id', label:'ID', get:o=>o.id, cell:o=>h('span',{class:'strong'},o.id)},
      {key:'date', label:'Date', get:o=>o.date+(o.time||''), cell:o=>dLabel(o.date)},
      {key:'observer', label:'Observer', get:o=>o.observer||''},
      {key:'dept', label:'Department', get:o=>o.dept||''},
      {key:'plant', label:'Plant', get:o=>o.plant||''},
      {key:'job', label:'Job', get:o=>o.job||'', cell:o=>{
        const j = o.job||'–';
        const w = h('span',{}, j.length>28? j.slice(0,27)+'…' : j);
        if ((o.photos||[]).length) w.append(h('span',{class:'chip mut', style:'margin-left:6px'},'📷 '+o.photos.length));
        return w; }},
      {key:'safe', label:'Safe', num:true, get:o=>obsTotals(o).s, cell:o=>h('span',{style:'color:var(--safe);font-weight:700'}, fmtN(obsTotals(o).s))},
      {key:'risk', label:'At Risk', num:true, get:o=>obsTotals(o).r, cell:o=>h('span',{style:'color:var(--risk);font-weight:700'}, fmtN(obsTotals(o).r))},
      {key:'pct', label:'% Safe', num:true, get:o=>obsTotals(o).pct ?? -1, cell:o=>{ const b=pctBand(obsTotals(o).pct); return h('span',{class:'chip '+b.cls}, b.icon+' '+b.label); }},
      {key:'acts', label:'Actions', num:true, get:o=>S.actions.filter(a=>a.obsId===o.id).length}
    ];
    mount.append(dataTable({cols, rows:list, state:st, selectable:true,
      onRow:{click:o=>openObsDetail(o.id)}, onSelect:()=>draw(), pageSize:25}));
  }
  draw();
}

function exportSelectedXlsx(ids){
  const keep = new Set(ids);
  const saved = {q:S.regF.q, dept:S.regF.dept, plant:S.regF.plant, from:S.regF.from, to:S.regF.to};
  const rows = regRows().filter(r=>keep.has(r.ID));
  if (!rows.length){ toast('Nothing to export','warn'); return; }
  if (typeof XLSX === 'undefined'){ toast('Excel library unavailable — use CSV','warn'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Selected');
  XLSX.writeFile(wb, 'IGL_BBS_Selected_'+todayStr()+'.xlsx');
  toast(rows.length+' observation(s) exported','good');
}

function importBtn(){
  const inp = h('input',{type:'file', accept:'.json', style:'display:none', onchange:e=>{
    const file = e.target.files[0]; if(!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try{
        const data = JSON.parse(rd.result);
        if (!data.observations || !Array.isArray(data.observations)) throw new Error('Not a valid IGL BBS backup file');
        const mode = confirm('OK = MERGE with existing data · Cancel = REPLACE all data');
        if (mode){
          const ids = new Set(S.obs.map(o=>o.id));
          let n=0;
          data.observations.forEach(o=>{ if(!ids.has(o.id)){ S.obs.push(o); n++; } });
          const aids = new Set(S.actions.map(a=>a.id));
          (data.actions||[]).forEach(a=>{ if(!aids.has(a.id)) S.actions.push(a); });
          toast('Merged '+n+' new observation(s)','good');
        } else {
          S.obs = data.observations; S.actions = data.actions||[];
          if (data.settings) S.set = Object.assign(defaultSettings(), data.settings);
          toast('Backup restored','good');
        }
        S.obs.sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
        saveObs(); saveAct(); saveSet(); updateCounts(); showView(S.view);
      }catch(err){ toast('Import failed: '+err.message,'bad'); }
    };
    rd.readAsText(file);
    e.target.value='';
  }});
  const b = h('button',{class:'btn sm', onclick:()=>inp.click()},'⬆ Import');
  const w = h('span',{}); w.append(b,inp); return w;
}

/* ---- detail modal ---- */
function openObsDetail(id){
  const o = S.obs.find(x=>x.id===id); if(!o) return;
  const t = obsTotals(o);
  const band = pctBand(t.pct);
  const body = h('div',{});
  const dl = h('dl',{class:'dl'});
  const add = (k,v)=>dl.append(h('dt',{},k),h('dd',{},v||'–'));
  add('Observer', o.observer); add('Department', o.dept); add('Plant / Unit', o.plant);
  add('Location', o.location); add('Date & time', dLabel(o.date)+(o.time?' · '+o.time:'')); add('Shift', o.shift);
  add('Job description', o.job); add('Type', o.type||'Planned'); add('People observed', String(o.people||1));
  add('Feedback given', o.feedback?'Yes':'No');
  body.append(dl, h('div',{class:'divider'}));

  const wrap = h('div',{class:'tbl-wrap'});
  const tb = h('table',{});
  tb.append(h('thead',{},h('tr',{},[h('th',{},'Ref'),h('th',{},'Item'),h('th',{class:'num'},'Safe'),h('th',{class:'num'},'At Risk'),h('th',{},'Remarks')])));
  const tbody = h('tbody');
  const refs = Object.keys(o.items||{}).sort((a,b)=>{ const [a1,a2]=a.split('.').map(Number),[b1,b2]=b.split('.').map(Number); return a1-b1||a2-b2; });
  refs.forEach(ref=>{
    const v = o.items[ref];
    const flags = [];
    if (v.corrected) flags.push('✓ corrected on spot');
    if (v.high) flags.push('⚠ high risk');
    tbody.append(h('tr',{},[
      h('td',{},h('span',{class:'strong'},ref)),
      h('td',{},itemText(ref)),
      h('td',{class:'num', style:'color:var(--safe);font-weight:700'}, v.s?String(v.s):''),
      h('td',{class:'num', style:'color:var(--risk);font-weight:700'}, v.r?String(v.r):''),
      h('td',{}, (v.remark||'')+(flags.length?(v.remark?' · ':'')+flags.join(' · '):''))
    ]));
  });
  tb.append(tbody); wrap.append(tb);
  body.append(wrap);
  body.append(h('div',{style:'display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap'},
    h('div',{class:'s'},h('span',{class:'note'},'Total Safe '),h('b',{style:'color:var(--safe);font-size:18px'},fmtN(t.s))),
    h('div',{},h('span',{class:'note'},'Total At Risk '),h('b',{style:'color:var(--risk);font-size:18px'},fmtN(t.r))),
    h('div',{},h('span',{class:'note'},'% Safe '),h('span',{class:'chip '+band.cls}, band.icon+' '+band.label))));

  const linked = S.actions.filter(a=>a.obsId===o.id);
  if (linked.length){
    body.append(h('div',{class:'divider'}), h('h3',{style:'font-size:13px;color:var(--ink2);margin-bottom:6px'},'Linked corrective actions'));
    linked.forEach(a=>body.append(h('div',{style:'font-size:13px;padding:4px 0'},
      h('span',{class:'chip '+(a.status==='Closed'?'good':a.status==='In Progress'?'info':'warn'), style:'margin-right:7px'},(a.status==='Closed'?'✓ ':a.status==='In Progress'?'● ':'⚠ ')+a.status),
      h('span',{class:'strong'},a.id+' '),' '+(a.desc.length>80?a.desc.slice(0,79)+'…':a.desc))));
  }

  if ((o.photos||[]).length){
    body.append(h('div',{class:'divider'}), h('h3',{style:'font-size:13px;color:var(--ink2);margin-bottom:6px'},'Photos'));
    const pr = h('div',{class:'photo-row'});
    o.photos.forEach((src,i)=>{
      const p = h('div',{class:'photo', onclick:()=>openPhoto(src)});
      p.append(h('img',{src, alt:'Observation photo '+(i+1)}));
      pr.append(p);
    });
    body.append(pr);
  }

  const aiOut = h('div',{style:'font-size:13px'});
  body.append(aiOut);

  modal.open({ title:'Observation '+o.id, body, foot:[
    h('button',{class:'btn sm', onclick:()=>printObs(o)},'🖨 Print'),
    h('button',{class:'btn sm', onclick:()=>exportObsXlsx(o)},'⬇ Excel (BBSO)'),
    h('button',{class:'btn sm', onclick:e=>runAi(e.target, aiOut, d=>aiSuggestActions(o,d), 'Thinking…')},'✦ AI actions'),
    h('button',{class:'btn sm', onclick:e=>runAi(e.target, aiOut, d=>aiRootCause(o,d), 'Analysing…')},'🔍 Root cause'),
    ...(Object.values(o.items||{}).some(v=>v.r>0) ? [h('button',{class:'btn sm', onclick:()=>{ modal.close(); severityModal(o); }},'⚖ Severity')] : []),
    ...((o.photos||[]).length ? [h('button',{class:'btn sm', onclick:()=>{ modal.close(); photoScanModal(o.photos); }},'📷 Scan photos')] : []),
    h('button',{class:'btn sm', onclick:()=>{
      modal.close();
      F = JSON.parse(JSON.stringify({...blankForm(), ...o}));
      F.id = null; F.date = todayStr(); F.time = nowTime(); F.photos = [];
      showView('new'); toast('Copied '+o.id+' into a new observation — review and save','good');
    }},'⧉ Duplicate'),
    h('button',{class:'btn sm', onclick:()=>{ modal.close(); F = JSON.parse(JSON.stringify({...blankForm(), ...o})); showView('new'); }},'✎ Edit'),
    h('button',{class:'btn sm danger', onclick:()=>{
      if (!confirm('Delete observation '+o.id+'? Linked actions will also be removed.')) return;
      const snapO = S.obs.slice(), snapA = S.actions.slice();
      S.obs = S.obs.filter(x=>x.id!==o.id);
      S.actions = S.actions.filter(a=>a.obsId!==o.id);
      saveObs(); saveAct(); updateCounts(); modal.close(); VIEWS[S.view].r();
      toastUndo('Observation '+o.id+' deleted', ()=>{ S.obs=snapO; S.actions=snapA; saveObs(); saveAct(); updateCounts(); VIEWS[S.view].r(); });
    }},'Delete'),
    h('button',{class:'btn sm primary', onclick:()=>modal.close()},'Close')
  ]});
}

/* ---- print ---- */
function printObs(o){
  const t = obsTotals(o);
  const pa = $('#print-area'); pa.textContent='';
  pa.append(h('h2',{},'India Glycols Limited — BBS Observation ('+o.id+')'));
  pa.append(h('div',{class:'note', style:'color:#555'},'Behaviour Based Safety · IGL BBSO format'));
  const ph = h('div',{class:'ph'});
  [['Observer',o.observer],['Date / Time',dLabel(o.date)+(o.time?' · '+o.time:'')],['Department',o.dept],['Shift',o.shift],['Plant / Unit',o.plant],['Type',o.type],['Location',o.location],['People observed',String(o.people||1)],['Job description',o.job],['Feedback given',o.feedback?'Yes':'No']]
    .forEach(([k,v])=>ph.append(h('div',{},h('b',{},k+': '),v||'–')));
  pa.append(ph);
  const tb = h('table',{});
  tb.append(h('thead',{},h('tr',{},[h('th',{},'Category'),h('th',{},'Ref'),h('th',{},'Item'),h('th',{},'Safe'),h('th',{},'At Risk'),h('th',{},'Remarks')])));
  const tbody = h('tbody');
  S.set.checklist.forEach(cat=>{
    let first = true;
    cat.items.forEach(it=>{
      const v = o.items[it.ref];
      if (!v || (!v.s && !v.r && !v.remark)) return;
      tbody.append(h('tr',{},[h('td',{}, first?cat.name:''), h('td',{},it.ref), h('td',{},it.text), h('td',{},v.s?String(v.s):''), h('td',{},v.r?String(v.r):''), h('td',{},v.remark||'')]));
      first = false;
    });
  });
  tbody.append(h('tr',{},[h('td',{},h('b',{},'Summary')),h('td',{},''),h('td',{},h('b',{},'Total')),h('td',{},h('b',{},String(t.s))),h('td',{},h('b',{},String(t.r))),h('td',{},h('b',{},'% Safe: '+(t.pct==null?'–':fmtP(t.pct))))]));
  tb.append(tbody); pa.append(tb);
  pa.append(h('div',{style:'margin-top:26px;display:flex;justify-content:space-between'},h('span',{},'Observer signature: ______________'),h('span',{},'HOD signature: ______________'),h('span',{},'EHS review: ______________')));
  window.print();
}

/* ---- exports ---- */
function dl(name, blob){
  const a = h('a',{href:URL.createObjectURL(blob), download:name}); document.body.append(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},400);
}
function regRows(){
  return filterObs({q:S.regF.q, dept:S.regF.dept, plant:S.regF.plant, from:S.regF.from, to:S.regF.to}).map(o=>{
    const t = obsTotals(o);
    const risks = Object.entries(o.items||{}).filter(([,v])=>v.r>0).map(([ref,v])=>ref+' '+itemText(ref)+(v.remark?' ('+v.remark+')':'')).join(' | ');
    return { ID:o.id, Date:o.date, Time:o.time||'', Observer:o.observer, Department:o.dept, Plant:o.plant, Location:o.location, Job:o.job, Shift:o.shift||'', Type:o.type||'', People:o.people||1, 'Total Safe':t.s, 'Total At Risk':t.r, '% Safe':t.pct==null?'':Math.round(t.pct*10)/10, 'At-risk details':risks, 'Feedback':o.feedback?'Yes':'No' };
  });
}
function exportRegisterCsv(){
  const rows = regRows();
  if (!rows.length){ toast('Nothing to export','warn'); return; }
  const cols = Object.keys(rows[0]);
  const esc = v => { v = String(v==null?'':v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const csv = [cols.join(','), ...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\r\n');
  dl('IGL_BBS_Register_'+todayStr()+'.csv', new Blob(['﻿'+csv],{type:'text/csv'}));
  toast('CSV exported','good');
}
function exportRegisterXlsx(){
  if (typeof XLSX === 'undefined'){ toast('Excel library not loaded (offline?) — exporting CSV instead','warn'); exportRegisterCsv(); return; }
  const rows = regRows();
  if (!rows.length){ toast('Nothing to export','warn'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k=>({wch: Math.min(40, Math.max(10, k.length+4)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'BBS Register');
  const acts = S.actions.map(a=>({ID:a.id, 'From observation':a.obsId||'', Ref:a.ref||'', Description:a.desc, Department:a.dept||'', Plant:a.plant||'', 'Assigned to':a.assignee||'', Due:a.due||'', Priority:a.priority, Status:a.status, 'Closed on':a.closedOn||'', 'Closure remarks':a.closure||''}));
  if (acts.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(acts), 'Actions');
  XLSX.writeFile(wb, 'IGL_BBS_Register_'+todayStr()+'.xlsx');
  toast('Excel exported','good');
}
function exportObsXlsx(o){
  if (typeof XLSX === 'undefined'){ toast('Excel library not loaded — use Print instead','warn'); return; }
  const t = obsTotals(o);
  const aoa = [
    ['BBS Observer Name :  '+o.observer,'','','','','Date : '+o.date],
    ['Plant                         :  '+o.plant,'','','','','Time :  '+(o.time||'')],
    ['Location                   :  '+o.location],
    ['Job Description        :  '+o.job],
    ['Category','Ref','Item Description','Safe','At Risk','Remarks']
  ];
  S.set.checklist.forEach(cat=>{
    cat.items.forEach((it,i)=>{
      const v = o.items[it.ref]||{};
      aoa.push([i===0?cat.name:'', it.ref, it.text, v.s||'', v.r||'', v.remark||'']);
    });
  });
  aoa.push(['Summary','','Total Safe', t.s,'','']);
  aoa.push(['','','Total at Risk','', t.r,'']);
  aoa.push(['','','% Safe', t.pct==null?'':Math.round(t.pct*1000)/10+'%','','']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{wch:34},{wch:6},{wch:44},{wch:7},{wch:8},{wch:50}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BBSO');
  XLSX.writeFile(wb, o.id+'_BBSO.xlsx');
  toast('BBSO sheet exported','good');
}
function exportBackup(){
  dl('IGL_BBS_Backup_'+todayStr()+'.json', new Blob([JSON.stringify({app:'IGL BBS', ver:APP_VER, exported:new Date().toISOString(), observations:S.obs, actions:S.actions, settings:S.set}, null, 1)],{type:'application/json'}));
  toast('Backup exported — keep it safe','good');
}
