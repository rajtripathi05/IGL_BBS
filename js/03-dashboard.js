/* ============================================================
   IGL BBS · 03-dashboard.js
   Dashboard view + shared observation table
   ============================================================ */

/* ================= Dashboard ================= */
function aggMonthly(list){
  const map = {};
  list.forEach(o=>{
    const k = mKey(o.date); if(!k) return;
    map[k] = map[k] || {n:0,s:0,r:0};
    const t = obsTotals(o);
    map[k].n++; map[k].s+=t.s; map[k].r+=t.r;
  });
  return Object.keys(map).sort().map(k=>({k, label:mLabel(k), ...map[k], pct: (map[k].s+map[k].r)? map[k].s/(map[k].s+map[k].r)*100 : null}));
}
function aggBy(list, key){
  const map = {};
  list.forEach(o=>{
    const k = o[key]||'—';
    map[k] = map[k] || {n:0,s:0,r:0};
    const t = obsTotals(o);
    map[k].n++; map[k].s+=t.s; map[k].r+=t.r;
  });
  return Object.entries(map).map(([label,v])=>({label, ...v, pct:(v.s+v.r)?v.s/(v.s+v.r)*100:null}));
}
function aggCat(list){
  const map = {};
  S.set.checklist.forEach(c=>map[c.name]={label:c.name, s:0, r:0});
  list.forEach(o=>{ for (const ref in (o.items||{})){ const cn = itemCat(ref); if(!map[cn]) map[cn]={label:cn,s:0,r:0}; map[cn].s+=+o.items[ref].s||0; map[cn].r+=+o.items[ref].r||0; } });
  return Object.values(map);
}
function aggItems(list){
  const map = {};
  list.forEach(o=>{ for (const ref in (o.items||{})){ const it=o.items[ref]; if(+it.r>0){ map[ref]=map[ref]||{ref,count:0,last:''}; map[ref].count+=+it.r; if(it.remark) map[ref].last=it.remark; } } });
  return Object.values(map).sort((a,b)=>b.count-a.count);
}

function renderDashboard(){
  const V = $('#view-dashboard'); V.textContent='';
  const f = S.dashF;
  const list = filterObs({period:f.period, dept:f.dept, plant:f.plant});

  /* filter row — one row, scopes everything below */
  V.append(h('div',{class:'filters'},
    fWrap('Period', selEl(PERIODS, f.period, v=>{S.dashF.period=v; renderDashboard();})),
    fWrap('Department', selEl(S.set.departments, f.dept, v=>{S.dashF.dept=v; renderDashboard();}, 'All departments')),
    fWrap('Plant / Area', selEl(S.set.plants, f.plant, v=>{S.dashF.plant=v; renderDashboard();}, 'All plants')),
    h('div',{style:'flex:1'}),
    h('button',{class:'btn sm', onclick:()=>showView('analyser')},'Open Analyser →')
  ));
  const db = demoBar(); if (db) V.append(db);
  else if (S.obs.length < 5) V.append(h('div',{class:'demo-bar'},
    h('span',{},'🎲 '), h('b',{},'Only '+fmtN(S.obs.length)+' record(s) so far'),
    h('span',{},'— load sample data to see how the dashboards, analyser and reports look with a full plant\u2019s worth of observations.'),
    h('span',{class:'grow'}),
    h('button',{class:'btn sm primary', onclick:()=>loadDemo(60)},'Load demo data')));

  if (!S.obs.length){
    V.append(h('div',{class:'card empty'},
      h('div',{class:'big'},'🦺'),
      h('h4',{},'Welcome to IGL BBS'),
      h('p',{},'No observations recorded yet. Record your first Behaviour Based Safety observation — or load sample data to explore every dashboard, chart and report first.'),
      h('div',{style:'display:flex;gap:9px;justify-content:center;flex-wrap:wrap'},
        h('button',{class:'btn primary', onclick:()=>{ F=null; showView('new'); }},'+ Start first observation'),
        h('button',{class:'btn', onclick:()=>loadDemo(60)},'🎲 Load demo data')),
      h('div',{class:'note', style:'margin-top:12px'},'Demo records are tagged and can be removed in one click. Press ',
        h('span',{class:'kbd'},'Ctrl'),' ',h('span',{class:'kbd'},'K'),' any time for search & commands.')));
    return;
  }

  /* KPI row */
  const tot = list.reduce((a,o)=>{ const t=obsTotals(o); a.s+=t.s; a.r+=t.r; return a; },{s:0,r:0});
  const pct = (tot.s+tot.r)? tot.s/(tot.s+tot.r)*100 : null;
  const people = list.reduce((a,o)=>a+(+o.people||0),0);
  const openA = S.actions.filter(a=>a.status!=='Closed');
  const overdue = openA.filter(a=>a.due && a.due<todayStr());
  const monthly = aggMonthly(list);
  const band = pctBand(pct);

  const kp = h('div',{class:'kpis'});
  const mkKpi = (l,v,d)=>{ const k=h('div',{class:'kpi'},h('div',{class:'l'},l),h('div',{class:'v'},v)); if(d)k.append(d); return k; };
  kp.append(mkKpi('Observations', fmtN(list.length), h('div',{class:'d'}, sparkline(monthly.map(m=>m.n), CH.safe), h('span',{},'by month'))));
  kp.append(mkKpi('People observed', fmtN(people)));
  kp.append(mkKpi('Safe behaviours', h('span',{style:'color:var(--safe)'},fmtN(tot.s))));
  kp.append(mkKpi('At-risk behaviours', h('span',{style:'color:var(--risk)'},fmtN(tot.r))));
  const kSafe = mkKpi('% Safe', pct==null?'–':fmtP(pct), null);
  kSafe.append(meterEl(pct||0, S.set.targetSafe), h('div',{class:'d'}, h('span',{class:'chip '+band.cls}, band.icon+' '+(pct==null?'no data':(pct>= (S.set.targetSafe||95)?'on target':'below target')))));
  kp.append(kSafe);
  kp.append(mkKpi('Open actions', fmtN(openA.length), h('div',{class:'d'}, overdue.length? h('span',{class:'chip crit'},'! '+overdue.length+' overdue') : h('span',{class:'chip good'},'✓ none overdue'))));
  /* participation this week + reporting streak */
  const wkAgo = new Date(); wkAgo.setDate(wkAgo.getDate()-6);
  const wkFrom = wkAgo.toISOString().slice(0,10);
  const thisWeek = S.obs.filter(o=>o.date>=wkFrom).length;
  const days = new Set(S.obs.map(o=>o.date));
  let streak = 0; const dd = new Date();
  for(;;){ const k = dd.toISOString().slice(0,10); if (days.has(k)) { streak++; dd.setDate(dd.getDate()-1); } else break; }
  kp.append(mkKpi('This week', fmtN(thisWeek), h('div',{class:'d'},
    h('span',{class:'chip '+(thisWeek>0?'good':'mut')}, thisWeek>0? '✓ active' : '· no observations yet'),
    streak>1 ? h('span',{class:'chip info'},'🔥 '+streak+'-day streak') : null)));
  V.append(kp);

  /* charts */
  const g = h('div',{class:'grid g2'});
  const cc = (title, hint, build, dataLink) => {
    const c = h('div',{class:'card chart-card'}, h('h3',{},title), h('div',{class:'hint'},hint));
    const m = h('div',{class:'ch'}); c.append(m); build(m);
    if (dataLink) c.append(h('div',{class:'viz-link'},'Data table: ', h('a',{href:'#', onclick:e=>{e.preventDefault(); showView('analyser');}},'BBS Analyser')));
    return c;
  };
  g.append(cc('% Safe trend','Monthly % safe vs target', m=>lineChart(m,{points:monthly.map(x=>({label:x.label,y:x.pct,extra:[{val:fmtN(x.n),lab:'observations'}]})), target:S.set.targetSafe}), true));
  g.append(cc('Observations per month','Participation volume', m=>colChart(m,{data:monthly.map(x=>({label:x.label,value:x.n}))}), true));
  const cats = aggCat(list);
  g.append(cc('Top at-risk categories','Where at-risk behaviours concentrate', m=>hbarChart(m,{data:cats.filter(c=>c.r>0).sort((a,b)=>b.r-a.r).slice(0,8).map(c=>({label:c.label,value:c.r})), color:CH.risk}), true));
  const stackCard = cc('Safe vs at-risk by category','Split of observed behaviours', m=>stackChart(m,{rows:cats.filter(c=>c.s+c.r>0).sort((a,b)=>(b.s+b.r)-(a.s+a.r)).slice(0,8).map(c=>({label:c.label,a:c.s,b:c.r}))}), true);
  stackCard.insertBefore(legend([{name:'Safe',color:CH.safe},{name:'At Risk',color:CH.risk}]), stackCard.querySelector('.ch'));
  g.append(stackCard);
  V.append(g);

  const g2 = h('div',{class:'grid g2', style:'margin-top:14px'});
  g2.append(cc('Department % safe','Against target of '+(S.set.targetSafe||95)+'%', m=>hbarChart(m,{data:aggBy(list,'dept').filter(d=>d.pct!=null).sort((a,b)=>a.pct-b.pct).slice(0,10).map(d=>({label:d.label,value:Math.round(d.pct*10)/10,hint:fmtN(d.n)+' observations'})), unit:'%', refLine:{value:S.set.targetSafe||95,label:'Target'}}), true));

  /* AI insight card */
  const aiC = h('div',{class:'card'}, h('h3',{},'AI safety insights'), h('div',{class:'hint'},'Pattern analysis of exactly the data in this filter'));
  const aiOut = h('div',{style:'font-size:13px;margin-top:8px'});
  const aiBtn = h('button',{class:'btn sm primary', onclick:()=>runAi(aiBtn, aiOut, d=>aiInsights(list, d), 'Analysing…')},'✦ Generate AI insights');
  const aiRow = h('div',{style:'display:flex;gap:7px;flex-wrap:wrap'}, aiBtn,
    h('button',{class:'btn sm', onclick:()=>aiOutputModal('Weekly digest', d=>aiDigest(7,d))},'📰 Weekly digest'),
    h('button',{class:'btn sm', onclick:()=>aiOutputModal('Toolbox talk', d=>aiToolboxTalk(null,d))},'🗣 Toolbox talk'),
    h('button',{class:'btn sm ghost', onclick:()=>showView('ai')},'All AI tools →'));
  aiC.append(aiRow, aiOut);
  g2.append(aiC);
  V.append(g2);

  /* at-risk heat map — category x month */
  const cats2 = aggCat(list).filter(c=>c.r>0).sort((a,b)=>b.r-a.r).slice(0,8);
  const months2 = aggMonthly(list).slice(-6);
  if (cats2.length && months2.length>1){
    const cell = (r,c) => {
      let n=0;
      list.forEach(o=>{ if (mKey(o.date)!==c.k) return;
        for (const ref in (o.items||{})) if (itemCat(ref)===r.label) n += +o.items[ref].r||0; });
      return n;
    };
    const hc = h('div',{class:'card chart-card', style:'margin-top:14px'},
      h('h3',{},'At-risk heat map'), h('div',{class:'hint'},'Where and when at-risk behaviours cluster — category by month'));
    const hm = h('div',{class:'ch'}); hc.append(hm);
    heatmap(hm, {rows:cats2.map(c=>({label:c.label})), cols:months2.map(m=>({label:m.label, k:m.k})), get:cell, label:'at-risk marks'});
    hc.append(h('div',{class:'viz-link'},'Same numbers as a table: ', h('a',{href:'#', onclick:e=>{e.preventDefault(); showView('analyser');}},'BBS Analyser')));
    V.append(hc);
  }

  /* departments with no observation this period */
  const seenD = new Set(list.map(o=>o.dept));
  const missing = S.set.departments.filter(d=>!seenD.has(d));
  if (missing.length){
    V.append(h('div',{class:'card', style:'margin-top:14px'},
      h('h3',{},'Departments with no observation in this period'),
      h('div',{class:'hint'},'Participation gap — '+missing.length+' of '+S.set.departments.length+' departments'),
      h('div',{style:'display:flex;gap:6px;flex-wrap:wrap'}, missing.map(d=>h('span',{class:'chip mut'},d)))));
  }

  /* recent + open actions */
  const g3 = h('div',{class:'split', style:'margin-top:14px'});
  const rec = h('div',{class:'card'}, h('h3',{},'Recent observations'), h('div',{class:'hint'},'Latest 8 records in this filter'));
  rec.append(obsTable(list.slice(0,8), {compact:true}));
  const act = h('div',{class:'card'}, h('h3',{},'Action pipeline'), h('div',{class:'hint'},'Open corrective actions by due date'));
  const openSorted = openA.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,6);
  if (!openSorted.length) act.append(h('div',{class:'empty'},'No open actions 🎉'));
  else openSorted.forEach(a=>{
    const od = a.due && a.due<todayStr();
    act.append(h('div',{style:'padding:8px 0;border-bottom:1px solid var(--line)'},
      h('div',{style:'display:flex;gap:8px;align-items:center'},
        h('span',{class:'chip '+(od?'crit':a.status==='In Progress'?'info':'warn')}, od?'! overdue':a.status==='In Progress'?'● in progress':'⚠ open'),
        h('span',{class:'note'}, a.id+' · due '+(a.due?dLabel(a.due):'–'))),
      h('div',{style:'font-size:13px;margin-top:3px;color:var(--ink)'}, a.desc.length>90?a.desc.slice(0,89)+'…':a.desc),
      h('div',{class:'note'}, (a.dept||'')+(a.assignee?' · '+a.assignee:''))));
  });
  act.append(h('div',{style:'margin-top:10px'}, h('button',{class:'btn sm', onclick:()=>showView('actions')},'All actions →')));
  g3.append(rec, act);
  V.append(g3);
}

/* shared observations table */
function obsTable(list, {compact=false}={}){
  if (!list.length) return h('div',{class:'empty'},'No observations match the current filters');
  const wrap = h('div',{class:'tbl-wrap'});
  const tb = h('table',{});
  const headCells = compact ? ['ID','Date','Observer','Plant','Safe','At Risk','% Safe'] : ['ID','Date','Observer','Department','Plant','Location','Safe','At Risk','% Safe','Actions'];
  tb.append(h('thead',{},h('tr',{}, headCells.map(c=>h('th',{class:['Safe','At Risk','% Safe','Actions'].includes(c)?'num':''},c)))));
  const body = h('tbody');
  list.forEach(o=>{
    const t = obsTotals(o);
    const band = pctBand(t.pct);
    const cells = [
      h('td',{},h('span',{class:'strong'},o.id)),
      h('td',{},dLabel(o.date)),
      h('td',{},o.observer||'–'),
      ...(compact?[]:[h('td',{},o.dept||'–')]),
      h('td',{},o.plant||'–'),
      ...(compact?[]:[h('td',{},(o.location||'–').length>24?o.location.slice(0,23)+'…':(o.location||'–'))]),
      h('td',{class:'num', style:'color:var(--safe);font-weight:700'},fmtN(t.s)),
      h('td',{class:'num', style:'color:var(--risk);font-weight:700'},fmtN(t.r)),
      h('td',{class:'num'},h('span',{class:'chip '+band.cls}, band.icon+' '+band.label)),
      ...(compact?[]:[h('td',{class:'num'}, String(S.actions.filter(a=>a.obsId===o.id).length))])
    ];
    body.append(h('tr',{class:'click', onclick:()=>openObsDetail(o.id)}, cells));
  });
  tb.append(body); wrap.append(tb);
  return wrap;
}
