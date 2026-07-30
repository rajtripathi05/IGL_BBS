/* ============================================================
   IGL BBS · 07-analyser.js
   BBS Analyser — category, trend & department analysis
   ============================================================ */

/* ================= BBS Analyser ================= */
function renderAnalyser(){
  const V = $('#view-analyser'); V.textContent='';
  const f = S.anaF;
  const observers = [...new Set(S.obs.map(o=>o.observer).filter(Boolean))].sort();
  V.append(h('div',{class:'filters'},
    fWrap('Period', selEl(PERIODS, f.period, v=>{S.anaF.period=v; renderAnalyser();})),
    fWrap('Department', selEl(S.set.departments, f.dept, v=>{S.anaF.dept=v; renderAnalyser();}, 'All departments')),
    fWrap('Plant / Area', selEl(S.set.plants, f.plant, v=>{S.anaF.plant=v; renderAnalyser();}, 'All plants')),
    fWrap('Observer', selEl(observers, f.observer, v=>{S.anaF.observer=v; renderAnalyser();}, 'All observers')),
    h('div',{style:'flex:1'}),
    h('button',{class:'btn sm', onclick:()=>exportAnalyserXlsx()},'⬇ Analyser report (Excel)'),
    h('button',{class:'btn sm primary', onclick:()=>{ showView('ai'); setTimeout(()=>{ const el=$('#ai-report'); if(el) el.scrollIntoView({behavior:'smooth'}); },60); }},'✦ AI monthly report')));

  const db = demoBar(); if (db) V.append(db);
  const list = filterObs({period:f.period, dept:f.dept, plant:f.plant, observer:f.observer});
  if (!list.length){ V.append(h('div',{class:'card empty'},
    h('div',{class:'big'},'📊'), h('h4',{},'Nothing to analyse yet'),
    h('p',{},'Record an observation, widen the period, or load sample data to explore the analyser.'),
    h('button',{class:'btn primary', onclick:()=>loadDemo(60)},'🎲 Load demo data'))); return; }

  const tot = list.reduce((a,o)=>{ const t=obsTotals(o); a.s+=t.s; a.r+=t.r; return a; },{s:0,r:0});
  const pct = (tot.s+tot.r)? tot.s/(tot.s+tot.r)*100 : null;
  const kp = h('div',{class:'kpis'});
  [['Observations',fmtN(list.length)],['Total safe',fmtN(tot.s)],['Total at risk',fmtN(tot.r)],['% Safe', pct==null?'–':fmtP(pct)],['Departments',fmtN(new Set(list.map(o=>o.dept)).size)],['Observers',fmtN(new Set(list.map(o=>o.observer)).size)]]
    .forEach(([l,v])=>kp.append(h('div',{class:'kpi'},h('div',{class:'l'},l),h('div',{class:'v'},v))));
  V.append(kp);

  /* category analysis — table + chart twin (as per BBS Checklist Analyser) */
  const cats = aggCat(list).map(c=>({...c, t:c.s+c.r, pct:(c.s+c.r)?c.s/(c.s+c.r)*100:null}));
  const catCard = h('div',{class:'card'}, h('h3',{},'Category-wise analysis'), h('div',{class:'hint'},'Safe / at-risk split per checklist category (BBSO)'));
  catCard.append(legend([{name:'Safe',color:CH.safe},{name:'At Risk',color:CH.risk}]));
  const catCh = h('div',{class:'ch'}); catCard.append(catCh);
  stackChart(catCh,{rows:cats.filter(c=>c.t>0).sort((a,b)=>b.t-a.t).map(c=>({label:c.label,a:c.s,b:c.r}))});
  const catTbl = h('table',{});
  catTbl.append(h('thead',{},h('tr',{},[h('th',{},'Category'),h('th',{class:'num'},'Safe'),h('th',{class:'num'},'At Risk'),h('th',{class:'num'},'Total'),h('th',{class:'num'},'% Safe')])));
  const ctb = h('tbody');
  cats.forEach(c=>{
    if (!c.t) return;
    const b = pctBand(c.pct);
    ctb.append(h('tr',{},[h('td',{},c.label),h('td',{class:'num'},fmtN(c.s)),h('td',{class:'num'},fmtN(c.r)),h('td',{class:'num'},fmtN(c.t)),h('td',{class:'num'},h('span',{class:'chip '+b.cls},b.icon+' '+b.label))]));
  });
  const bAll = pctBand(pct);
  ctb.append(h('tr',{},[h('td',{},h('span',{class:'strong'},'Total')),h('td',{class:'num'},h('span',{class:'strong'},fmtN(tot.s))),h('td',{class:'num'},h('span',{class:'strong'},fmtN(tot.r))),h('td',{class:'num'},h('span',{class:'strong'},fmtN(tot.s+tot.r))),h('td',{class:'num'},h('span',{class:'chip '+bAll.cls},bAll.icon+' '+bAll.label))]));
  catTbl.append(ctb);
  catCard.append(h('div',{class:'tbl-wrap', style:'margin-top:12px'},catTbl));
  V.append(catCard);

  /* heat map — category x month */
  const monthsHM = aggMonthly(list).slice(-8);
  const catsHM = cats.filter(c=>c.r>0).sort((a,b)=>b.r-a.r).slice(0,10);
  if (catsHM.length && monthsHM.length>1){
    const hc = h('div',{class:'card chart-card', style:'margin-top:14px'},
      h('h3',{},'At-risk heat map'), h('div',{class:'hint'},'At-risk marks by category and month — darkest cells are where to act'));
    const hm = h('div',{class:'ch'}); hc.append(hm);
    heatmap(hm, {rows:catsHM.map(c=>({label:c.label})), cols:monthsHM.map(m=>({label:m.label,k:m.k})),
      get:(r,c)=>{ let n=0; list.forEach(o=>{ if(mKey(o.date)!==c.k) return; for(const ref in (o.items||{})) if(itemCat(ref)===r.label) n += +o.items[ref].r||0; }); return n; },
      label:'at-risk marks'});
    V.append(hc);
  }

  const g = h('div',{class:'grid g2', style:'margin-top:14px'});

  /* monthly table */
  const monthly = aggMonthly(list);
  const mCard = h('div',{class:'card'}, h('h3',{},'Monthly trend'), h('div',{class:'hint'},'Observations and % safe by month'));
  const mCh = h('div',{class:'ch'}); mCard.append(mCh);
  lineChart(mCh,{points:monthly.map(x=>({label:x.label,y:x.pct,extra:[{val:fmtN(x.n),lab:'observations'}]})), target:S.set.targetSafe, height:180});
  const mt = h('table',{});
  mt.append(h('thead',{},h('tr',{},[h('th',{},'Month'),h('th',{class:'num'},'Obs'),h('th',{class:'num'},'Safe'),h('th',{class:'num'},'At Risk'),h('th',{class:'num'},'% Safe')])));
  const mtb = h('tbody');
  monthly.forEach(m=>{
    const b = pctBand(m.pct);
    mtb.append(h('tr',{},[h('td',{},m.label),h('td',{class:'num'},fmtN(m.n)),h('td',{class:'num'},fmtN(m.s)),h('td',{class:'num'},fmtN(m.r)),h('td',{class:'num'},h('span',{class:'chip '+b.cls},b.icon+' '+b.label))]));
  });
  mt.append(mtb);
  mCard.append(h('div',{class:'tbl-wrap', style:'margin-top:10px'},mt));
  g.append(mCard);

  /* top at-risk items */
  const items = aggItems(list);
  const iCard = h('div',{class:'card'}, h('h3',{},'Top repeated at-risk items'), h('div',{class:'hint'},'Most frequent unsafe behaviours / conditions'));
  if (!items.length) iCard.append(h('div',{class:'empty'},'No at-risk behaviours recorded 🎉'));
  else {
    const it = h('table',{});
    it.append(h('thead',{},h('tr',{},[h('th',{},'Ref'),h('th',{},'Item'),h('th',{class:'num'},'Count'),h('th',{},'Latest remark')])));
    const itb = h('tbody');
    items.slice(0,12).forEach(x=>{
      itb.append(h('tr',{},[h('td',{},h('span',{class:'strong'},x.ref)),h('td',{},itemText(x.ref)),h('td',{class:'num', style:'color:var(--risk);font-weight:800'},fmtN(x.count)),h('td',{style:'max-width:240px'},(x.last||'–').length>70?x.last.slice(0,69)+'…':(x.last||'–'))]));
    });
    it.append(itb);
    iCard.append(h('div',{class:'tbl-wrap'},it));
  }
  g.append(iCard);

  /* department table */
  const depts = aggBy(list,'dept').map(d=>({...d, t:d.s+d.r}));
  const dCard = h('div',{class:'card'}, h('h3',{},'Department scorecard'), h('div',{class:'hint'},'Participation vs monthly target ('+(S.set.monthlyTarget||4)+' obs) and % safe'));
  const dt = h('table',{});
  dt.append(h('thead',{},h('tr',{},[h('th',{},'Department'),h('th',{class:'num'},'Obs'),h('th',{class:'num'},'Safe'),h('th',{class:'num'},'At Risk'),h('th',{class:'num'},'% Safe'),h('th',{},'Participation')])));
  const dtb = h('tbody');
  const monthsInRange = Math.max(1, monthly.length);
  depts.sort((a,b)=>b.n-a.n).forEach(d=>{
    const b = pctBand(d.pct);
    const tgt = (S.set.monthlyTarget||4)*monthsInRange;
    const part = Math.min(100, Math.round(d.n/tgt*100));
    dtb.append(h('tr',{},[
      h('td',{},d.label),h('td',{class:'num'},fmtN(d.n)),h('td',{class:'num'},fmtN(d.s)),h('td',{class:'num'},fmtN(d.r)),
      h('td',{class:'num'},h('span',{class:'chip '+b.cls},b.icon+' '+b.label)),
      h('td',{style:'min-width:120px'}, (()=>{ const m=h('div',{class:'meter', style:'margin-top:0'}); m.append(h('div',{class:'fill', style:'width:'+part+'%;background:'+(part>=100?'var(--good)':'var(--safe)')})); return h('div',{},m,h('span',{class:'note'},part+'% of target')); })())
    ]));
  });
  dt.append(dtb);
  dCard.append(h('div',{class:'tbl-wrap'},dt));
  g.append(dCard);

  /* observer leaderboard */
  const obsAgg = aggBy(list,'observer');
  const oCard = h('div',{class:'card'}, h('h3',{},'Observer leaderboard'), h('div',{class:'hint'},'Active observers — quality means finding at-risk behaviours too'));
  const ot = h('table',{});
  ot.append(h('thead',{},h('tr',{},[h('th',{},'Observer'),h('th',{class:'num'},'Observations'),h('th',{class:'num'},'At-risk found'),h('th',{},'Last observation')])));
  const otb = h('tbody');
  obsAgg.sort((a,b)=>b.n-a.n).slice(0,12).forEach(o=>{
    const last = list.filter(x=>x.observer===o.label).sort((a,b)=>b.date.localeCompare(a.date))[0];
    otb.append(h('tr',{},[h('td',{},o.label),h('td',{class:'num'},fmtN(o.n)),h('td',{class:'num', style:'color:var(--risk);font-weight:700'},fmtN(o.r)),h('td',{},last?dLabel(last.date):'–')]));
  });
  ot.append(otb);
  oCard.append(h('div',{class:'tbl-wrap'},ot));
  g.append(oCard);
  V.append(g);
}

function exportAnalyserXlsx(){
  if (typeof XLSX === 'undefined'){ toast('Excel library not loaded (offline?)','warn'); return; }
  const f = S.anaF;
  const list = filterObs({period:f.period, dept:f.dept, plant:f.plant, observer:f.observer});
  if (!list.length){ toast('Nothing to export','warn'); return; }
  const tot = list.reduce((a,o)=>{ const t=obsTotals(o); a.s+=t.s; a.r+=t.r; return a; },{s:0,r:0});
  const wb = XLSX.utils.book_new();
  const period = PERIODS.find(p=>p[0]===f.period);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['India Glycols Limited — BBS Analyser Report'],
    ['Generated', new Date().toLocaleString('en-IN')],
    ['Period', period?period[1]:'All'], ['Department', f.dept||'All'], ['Plant', f.plant||'All'], ['Observer', f.observer||'All'],
    [],
    ['Observations', list.length], ['Total Safe', tot.s], ['Total At Risk', tot.r],
    ['% Safe', (tot.s+tot.r)? Math.round(tot.s/(tot.s+tot.r)*1000)/10+'%' : '–'],
    ['Target % Safe', (S.set.targetSafe||95)+'%']
  ]), 'Summary');
  const cats = aggCat(list).map(c=>({Category:c.label, Safe:c.s, 'At Risk':c.r, Total:c.s+c.r, '% Safe':(c.s+c.r)?Math.round(c.s/(c.s+c.r)*1000)/10:''})).filter(c=>c.Total>0);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cats), 'By Category');
  const monthly = aggMonthly(list).map(m=>({Month:m.label, Observations:m.n, Safe:m.s, 'At Risk':m.r, '% Safe':m.pct==null?'':Math.round(m.pct*10)/10}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthly), 'Monthly');
  const depts = aggBy(list,'dept').map(d=>({Department:d.label, Observations:d.n, Safe:d.s, 'At Risk':d.r, '% Safe':d.pct==null?'':Math.round(d.pct*10)/10}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depts), 'By Department');
  const obsA = aggBy(list,'observer').map(o=>({Observer:o.label, Observations:o.n, 'At-risk found':o.r}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obsA), 'Observers');
  const items = aggItems(list).map(x=>({Ref:x.ref, Item:itemText(x.ref), Category:itemCat(x.ref), 'At-risk count':x.count, 'Latest remark':x.last}));
  if (items.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'At-Risk Items');
  XLSX.writeFile(wb, 'IGL_BBS_Analyser_'+todayStr()+'.xlsx');
  toast('Analyser report exported','good');
}
