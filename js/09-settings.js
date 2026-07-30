/* ============================================================
   IGL BBS · 09-settings.js
   Settings, master data, demo generator & app init
   ============================================================ */

/* ================= Settings ================= */
function renderSettings(){
  const V = $('#view-settings'); V.textContent='';
  const g = h('div',{class:'grid g2'});

  /* profile */
  const prof = h('div',{class:'card'}, h('h3',{},'My defaults'), h('div',{class:'hint'},'Pre-filled on every new observation'));
  prof.append(h('div',{class:'grid g3'},
    h('div',{},h('label',{},'Name'),h('input',{type:'text', value:S.set.profile.name||'', oninput:e=>{S.set.profile.name=e.target.value; saveSet();}})),
    h('div',{},h('label',{},'Department'),selEl(S.set.departments, S.set.profile.dept, v=>{S.set.profile.dept=v; saveSet();}, '—')),
    h('div',{},h('label',{},'Plant'),selEl(S.set.plants, S.set.profile.plant, v=>{S.set.profile.plant=v; saveSet();}, '—'))));
  g.append(prof);

  /* targets */
  const tgt = h('div',{class:'card'}, h('h3',{},'Targets'), h('div',{class:'hint'},'Used across dashboard, analyser and scorecards'));
  tgt.append(h('div',{class:'grid g2'},
    h('div',{},h('label',{},'% Safe target'),h('input',{type:'number', min:50, max:100, value:S.set.targetSafe, onchange:e=>{S.set.targetSafe=Math.max(50,Math.min(100,+e.target.value||95)); saveSet(); toast('Target updated');}})),
    h('div',{},h('label',{},'Monthly observations target per department'),h('input',{type:'number', min:1, value:S.set.monthlyTarget, onchange:e=>{S.set.monthlyTarget=Math.max(1,+e.target.value||4); saveSet(); toast('Target updated');}}))));
  g.append(tgt);

  /* master data */
  const md1 = h('div',{class:'card'}, h('h3',{},'Departments'), h('div',{class:'hint'},'One per line — BBS access is open to all departments'));
  const depTa = h('textarea',{style:'min-height:170px'}, S.set.departments.join('\n'));
  md1.append(depTa, h('button',{class:'btn sm', style:'margin-top:8px', onclick:()=>{ S.set.departments = depTa.value.split('\n').map(s=>s.trim()).filter(Boolean); saveSet(); toast('Departments saved ('+S.set.departments.length+')','good'); }},'💾 Save departments'));
  const md2 = h('div',{class:'card'}, h('h3',{},'Plants / Areas'), h('div',{class:'hint'},'One per line'));
  const plTa = h('textarea',{style:'min-height:170px'}, S.set.plants.join('\n'));
  md2.append(plTa, h('button',{class:'btn sm', style:'margin-top:8px', onclick:()=>{ S.set.plants = plTa.value.split('\n').map(s=>s.trim()).filter(Boolean); saveSet(); toast('Plants saved ('+S.set.plants.length+')','good'); }},'💾 Save plants'));
  g.append(md1, md2);
  V.append(g);

  /* checklist editor */
  const cl = h('div',{class:'card', style:'margin-top:14px'}, h('h3',{},'BBSO checklist editor'), h('div',{class:'hint'},'Edit item text, switch items off, or add new items (e.g. under Others). Changes apply to new observations.'));
  S.set.checklist.forEach(cat=>{
    const box = h('div',{class:'cat'});
    const bd = h('div',{class:'cat-b'});
    const hd = h('div',{class:'cat-h', onclick:()=>box.classList.toggle('open')},
      h('span',{class:'arr'},'▶'), h('span',{class:'nm'}, cat.id+'. '+cat.name), h('span',{class:'note'}, cat.items.filter(i=>!i.off).length+' items'));
    cat.items.forEach(it=>{
      const row = h('div',{class:'item', style:'grid-template-columns:44px 1fr auto'});
      const txt = h('input',{type:'text', value:it.text, style:it.off?'opacity:.45':'', oninput:e=>{it.text=e.target.value; saveSet();}});
      const off = h('button',{class:'btn sm ghost', onclick:()=>{ it.off=!it.off; saveSet(); renderSettings(); }}, it.off?'Enable':'Disable');
      row.append(h('span',{class:'ref'},it.ref), txt, h('div',{class:'ctr'},off));
      bd.append(row);
    });
    const addB = h('button',{class:'btn sm', style:'margin:10px 14px', onclick:()=>{
      const nums = cat.items.map(i=>+String(i.ref).split('.')[1]||0);
      const ref = cat.id + '.' + (Math.max(0,...nums)+1);
      const text = prompt('New checklist item under "'+cat.name+'" ('+ref+'):');
      if (text && text.trim()){ cat.items.push({ref, text:text.trim()}); saveSet(); renderSettings(); toast('Item '+ref+' added','good'); }
    }},'+ Add item');
    bd.append(addB);
    box.append(hd, bd); cl.append(box);
  });
  V.append(cl);

  /* appearance */
  const ap = h('div',{class:'card', style:'margin-top:14px'}, h('h3',{},'Appearance'), h('div',{class:'hint'},'Applies to this browser only'));
  const segTheme = h('div',{class:'seg'});
  [['dark','🌙 Dark'],['light','☀ Light']].forEach(([v,l])=>segTheme.append(h('button',{class:(S.set.theme||'dark')===v?'on':'', onclick:()=>{ applyTheme(v); }},l)));
  const segDen = h('div',{class:'seg'});
  [['comfortable','Comfortable'],['compact','Compact']].forEach(([v,l])=>segDen.append(h('button',{class:(S.set.density||'comfortable')===v?'on':'', onclick:()=>{ applyDensity(v); renderSettings(); }},l)));
  ap.append(h('div',{class:'grid g2'},
    h('div',{}, h('label',{},'Theme'), segTheme),
    h('div',{}, h('label',{},'Row density'), segDen)));
  ap.append(h('div',{style:'margin-top:10px'}, h('button',{class:'btn sm ghost', onclick:()=>showShortcuts()},'⌨ Keyboard shortcuts')));
  V.append(ap);

  /* data management */
  const dm = h('div',{class:'card', style:'margin-top:14px'}, h('h3',{},'Data management'), h('div',{class:'hint'}, store.persistent ? 'Data is stored in this browser (offline-capable). Use backups to move or merge data between computers — e.g. departments export weekly and EHS imports & merges.' : '⚠ This browser is blocking storage — data will be lost when you close the page. Use Export backup.'));
  /* storage usage */
  try{
    let bytes = 0; for (const k in localStorage) if (k.startsWith('iglbbs.')) bytes += (localStorage.getItem(k)||'').length;
    const mb = bytes/1048576, pct = Math.min(100, mb/5*100);
    const photos = S.obs.reduce((a,o)=>a+((o.photos||[]).length),0);
    const su = h('div',{style:'margin-bottom:12px'});
    su.append(h('div',{class:'note'}, 'Using '+mb.toFixed(2)+' MB of roughly 5 MB browser storage · '+fmtN(S.obs.length)+' observations · '+fmtN(photos)+' photos'));
    const m = h('div',{class:'meter'}); m.append(h('div',{class:'fill', style:'width:'+pct+'%;background:'+(pct>80?'var(--crit)':pct>60?'var(--warn)':'var(--safe)')}));
    su.append(m);
    if (pct>70) su.append(h('div',{class:'note', style:'margin-top:6px;color:var(--warn)'},'⚠ Storage is filling up — export a backup and clear demo data or old photos.'));
    dm.append(su);
  }catch(e){}
  dm.append(h('div',{style:'display:flex;gap:8px;flex-wrap:wrap'},
    h('button',{class:'btn sm', onclick:()=>exportBackup()},'⬇ Export backup (JSON)'),
    importBtn(),
    h('button',{class:'btn sm', onclick:()=>exportRegisterXlsx()},'⬇ Export register (Excel)'),
    h('button',{class:'btn sm', onclick:()=>loadDemo(60)},'🎲 Load 60 demo records'),
    h('button',{class:'btn sm', onclick:()=>loadDemo(200)},'🎲 Load 200'),
    ...(hasDemo()? [h('button',{class:'btn sm', onclick:()=>clearDemo()},'🧹 Clear demo data ('+fmtN(demoCount())+')')] : []),
    h('button',{class:'btn sm danger', onclick:()=>{
      if (!confirm('Delete ALL observations, actions and chat history?')) return;
      if (!confirm('Really sure? Export a backup first if in doubt.')) return;
      S.obs=[]; S.actions=[]; S.chat=[];
      saveObs(); saveAct(); saveChat(); updateCounts(); toast('All data cleared'); showView('dashboard');
    }},'🗑 Clear all data')));
  V.append(dm);

  /* about */
  const ab = h('div',{class:'card', style:'margin-top:14px'}, h('h3',{},'About'), h('div',{class:'hint'},'IGL BBS v'+APP_VER));
  ab.append(h('p',{class:'note'},'Behaviour Based Safety observation system of India Glycols Limited. Digitises the IGL BBSO checklist with dashboards, analyser, corrective action tracking and AI assistance. Works offline; data lives in the browser. Part of the ', h('a',{href:PORTAL_URL, target:'_blank', rel:'noopener'},'IGL HSE Portal'), ' ecosystem.'));
  V.append(ab);
}

/* demo data generator — realistic spread over the last 6 months */
function genDemo(count){
  const N = Math.max(5, +count || 60);
  const names = ['Brajraj Singh','A. Sharma','R. Verma','S. Kumar','P. Joshi','M. Ansari','V. Rawat','D. Negi','K. Pandey','N. Bisht','S. Chauhan','T. Rana'];
  const jobs = ['Pump seal replacement','Tanker unloading','Sample collection','Vessel cleaning','Scaffold erection','Line flushing','Hot work — welding','Catalyst charging','Valve overhauling','Cable laying','Drum shifting','Filter cleaning','Height work — pipe rack','Confined space entry'];
  const flat = [];
  S.set.checklist.forEach(c=>c.items.forEach(it=>{ if(!it.off) flat.push(it.ref); }));
  const riskRemarks = ['PPE not worn properly, corrected at site','Housekeeping poor near pump area','Tool without inspection tag','Standing in line of fire during lifting','Spillage observed near walkway','Working without valid PTW copy at site','Chin strap loose, corrected immediately','Improper stacking of drums','Using mobile phone in process area','Ladder not tied off','Hose connection not secured','Gas cylinder not chained','Barricading missing around excavation','Full body harness not anchored'];
  const now = new Date();
  const before = S.obs.length;
  for (let i=0;i<N;i++){
    const d = new Date(now); d.setDate(d.getDate()-Math.floor(Math.random()*180));
    const date = d.toISOString().slice(0,10);
    /* safety performance improves slightly over time so the trend chart tells a story */
    const ageMonths = (now - d)/(1000*60*60*24*30);
    const riskRate = 0.07 + ageMonths*0.017;
    const items = {}; const picked = new Set();
    const nItems = 6+Math.floor(Math.random()*8);
    for (let j=0;j<nItems;j++){
      const ref = flat[Math.floor(Math.random()*flat.length)];
      if (picked.has(ref)) continue; picked.add(ref);
      const risky = Math.random() < riskRate;
      items[ref] = risky
        ? {s:0,r:1,remark:riskRemarks[Math.floor(Math.random()*riskRemarks.length)],corrected:Math.random()<0.7,action:Math.random()<0.55,high:Math.random()<0.18}
        : {s:1+Math.floor(Math.random()*2),r:0,remark:''};
    }
    const o = { id:nextObsId(), observer:names[Math.floor(Math.random()*names.length)],
      dept:S.set.departments[Math.floor(Math.random()*S.set.departments.length)],
      plant:S.set.plants[Math.floor(Math.random()*S.set.plants.length)],
      date, time:String(6+Math.floor(Math.random()*12)).padStart(2,'0')+':'+(Math.random()<0.5?'00':'30'),
      shift:S.set.shifts[Math.floor(Math.random()*S.set.shifts.length)],
      location:'Area '+(1+Math.floor(Math.random()*9)),
      job:jobs[Math.floor(Math.random()*jobs.length)],
      type:Math.random()<0.7?'Planned':'Unplanned', people:1+Math.floor(Math.random()*4), feedback:Math.random()<0.85,
      items, photos:[], createdAt:date+'T09:00:00', demo:true };
    S.obs.push(o);
    for (const ref in items){ const v=items[ref];
      if (v.r>0 && v.action){
        const due = new Date(d); due.setDate(due.getDate()+(v.high?3:7));
        S.actions.push({ id:nextActId(), obsId:o.id, ref, desc:'['+ref+'] '+itemText(ref)+' — '+v.remark, dept:o.dept, plant:o.plant,
          assignee:names[Math.floor(Math.random()*names.length)], due:due.toISOString().slice(0,10),
          priority:v.high?'High':'Medium', status:Math.random()<0.55?'Closed':(Math.random()<0.5?'In Progress':'Open'),
          createdAt:o.createdAt, closedOn:'', closure:'', demo:true });
      }
    }
  }
  S.actions.forEach(a=>{ if(a.status==='Closed'&&!a.closedOn){ a.closedOn=a.due; a.closure='Verified at site'; } });
  S.obs.sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  saveObs(); saveAct(); updateCounts();
  return S.obs.length - before;
}

