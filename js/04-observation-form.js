/* ============================================================
   IGL BBS · 04-observation-form.js
   New / edit BBS observation form
   ============================================================ */

/* ================= New Observation form ================= */
let F = null; /* form working state */

function blankForm(){
  return {
    id:null, observer:S.set.profile.name||'', dept:S.set.profile.dept||'', plant:S.set.profile.plant||'',
    date:todayStr(), time:nowTime(), shift:S.set.shifts[0]||'General',
    location:'', job:'', type:'Planned', people:1, feedback:true,
    items:{}, photos:[]
  };
}
function formTotals(){
  let s=0,r=0;
  for (const k in F.items){ s+=+F.items[k].s||0; r+=+F.items[k].r||0; }
  return {s,r,t:s+r,pct:(s+r)?s/(s+r)*100:null};
}

function renderNew(){
  const V = $('#view-new'); V.textContent='';
  if (!F) F = blankForm();
  const editing = !!F.id;

  if (editing) V.append(h('div',{class:'card', style:'margin-bottom:12px;border-color:rgba(250,178,25,.4)'},
    h('span',{class:'chip warn'},'✎ Editing '+F.id),
    h('button',{class:'btn sm ghost', style:'margin-left:10px', onclick:()=>{F=blankForm(); renderNew();}},'Cancel edit')));

  /* header fields */
  const head = h('div',{class:'card'}, h('h3',{},'Observation details'), h('div',{class:'hint'},'As per IGL BBSO format'));
  const grid = h('div',{class:'obs-head'});
  const inp = (label, key, type='text', extra={}) => {
    const i = h('input',{type, value:F[key]??'', ...extra, oninput:e=>F[key]=e.target.value});
    return h('div',{}, h('label',{},label), i);
  };
  const sel = (label, key, opts, allowEmpty) => {
    const s = selEl(opts, F[key], v=>F[key]=v, allowEmpty?'— select —':null);
    if (!allowEmpty) s.value = F[key]||opts[0];
    return h('div',{}, h('label',{},label), s);
  };
  grid.append(
    inp('Observer name *','observer','text',{placeholder:'Your full name'}),
    sel('Department *','dept',S.set.departments,true),
    sel('Plant / Unit *','plant',S.set.plants,true),
    inp('Location *','location','text',{placeholder:'e.g. Analyser House, MEG'}),
    inp('Date *','date','date'),
    inp('Time','time','time'),
    sel('Shift','shift',S.set.shifts),
    sel('Observation type','type',['Planned','Unplanned']),
    inp('People observed','people','number',{min:1}),
    h('div',{style:'grid-column:1/-1'}, h('label',{},'Job / activity description *'), h('input',{type:'text', value:F.job||'', placeholder:'What job was being performed?', oninput:e=>F.job=e.target.value}))
  );
  head.append(grid);
  V.append(head);

  /* AI quick fill */
  const ai = h('div',{class:'ai-fill'},
    h('div',{style:'display:flex;align-items:center;gap:8px;margin-bottom:8px'},
      h('span',{style:'font-weight:800;color:var(--acc)'},'✦ AI quick fill'),
      h('span',{class:'note'},'Describe the observation in plain words — AI marks the checklist for you (review before saving)')));
  const aiTxt = h('textarea',{placeholder:'e.g. Two fitters replacing a pump seal. Both wearing full PPE, tools in good condition, work permit displayed. One was standing under a suspended load for a moment and area had some oil spillage near the walkway…'});
  const aiRow = h('div',{style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'});
  const aiBtn = h('button',{class:'btn primary sm', onclick:async ()=>{
    if (!S.set.openrouter.key){ toast('Set your OpenRouter API key first (AI Assistant → Setup)','warn'); showView('ai'); return; }
    if (!aiTxt.value.trim()){ toast('Describe the observation first','warn'); return; }
    aiBtn.disabled=true; const old=aiBtn.textContent; aiBtn.textContent=''; aiBtn.append(h('span',{class:'spin'}),' Mapping to checklist…');
    try{
      const res = await aiFillChecklist(aiTxt.value.trim());
      let n=0;
      for (const ref in res){
        if (!itemText(ref) || itemText(ref)===ref) continue;
        F.items[ref] = { s:+res[ref].safe||0, r:+res[ref].risk||0, remark:String(res[ref].remark||'').slice(0,300), corrected:false, action:!!(+res[ref].risk), high:false };
        if (!F.items[ref].s && !F.items[ref].r) delete F.items[ref]; else n++;
      }
      renderNew();
      toast('AI marked '+n+' checklist items — please review','good');
    }catch(err){ toast('AI error: '+err.message,'bad'); aiBtn.disabled=false; aiBtn.textContent=old; }
  }},'✦ Fill checklist with AI');
  const micBtn = dictateButton(t=>{ aiTxt.value = (aiTxt.value ? aiTxt.value+' ' : '') + t; });
  const scanBtn = h('button',{class:'btn sm', onclick:()=>{
    if (!(F.photos||[]).length){ toast('Attach a photo below first, then scan','warn'); return; }
    photoScanModal(F.photos);
  }},'📷 Scan attached photos');
  aiRow.append(aiBtn, micBtn, scanBtn);
  ai.append(aiTxt, aiRow);
  V.append(ai);

  /* ---- photos ---- */
  const ph = h('div',{class:'card', style:'margin-bottom:14px'}, h('h3',{},'Photos'),
    h('div',{class:'hint'},'Optional — attached to this observation and stored in this browser. Images are resized before saving.'));
  const phRow = h('div',{class:'photo-row'});
  const drawPhotos = ()=>{
    phRow.textContent='';
    (F.photos||[]).forEach((src,i)=>{
      const p = h('div',{class:'photo', onclick:()=>openPhoto(src)});
      p.append(h('img',{src, alt:'Observation photo '+(i+1)}),
        h('button',{class:'rm', title:'Remove', onclick:e=>{ e.stopPropagation(); F.photos.splice(i,1); drawPhotos(); }},'✕'));
      phRow.append(p);
    });
    if ((F.photos||[]).length < 4) phRow.append(photoAddButton(src=>{ F.photos = F.photos||[]; F.photos.push(src); drawPhotos(); }, 'Add photo'));
  };
  drawPhotos();
  ph.append(phRow);
  V.append(ph);

  /* checklist toolbar */
  const chkBar = h('div',{class:'filters', style:'align-items:center'});
  const chkSearch = h('input',{type:'search', id:'chk-search', placeholder:'Filter checklist items…', oninput:()=>applyFilter()});
  const ringWrap = h('span',{class:'progress-ring'});
  chkBar.append(h('div',{class:'f', style:'flex:1;min-width:220px'}, h('label',{},'Find an item'), chkSearch),
    h('div',{class:'f'}, h('label',{},'Sections'), h('div',{style:'display:flex;gap:6px'},
      h('button',{class:'btn sm', onclick:()=>$$('.cat', wrap).forEach(c=>c.classList.add('open'))},'Expand all'),
      h('button',{class:'btn sm', onclick:()=>$$('.cat', wrap).forEach(c=>c.classList.remove('open'))},'Collapse all'))),
    h('div',{class:'f'}, h('label',{},'Progress'), ringWrap));

  V.append(chkBar);

  /* checklist */
  const wrap = h('div',{});
  S.set.checklist.forEach((cat,ci)=>{
    const counts = () => {
      let s=0,r=0; cat.items.forEach(it=>{ const v=F.items[it.ref]; if(v){s+=+v.s||0;r+=+v.r||0;} });
      return {s,r};
    };
    const c = h('div',{class:'cat'+(ci===0||cat.items.some(it=>F.items[it.ref])?' open':'')});
    const badge = h('span',{});
    const refreshBadge = ()=>{
      const k = counts(); badge.textContent='';
      if (k.s) badge.append(h('span',{class:'chip info', style:'margin-right:5px'},'Safe '+k.s));
      if (k.r) badge.append(h('span',{class:'chip crit'},'Risk '+k.r));
    };
    refreshBadge();
    const qa = h('div',{class:'qa'},
      h('button',{title:'Mark every item in this section as safe', onclick:e=>{ e.stopPropagation();
        cat.items.forEach(it=>{ if(it.off) return; const v = F.items[it.ref] || (F.items[it.ref]={s:0,r:0,remark:'',corrected:false,action:false,high:false}); if(!v.r) v.s = Math.max(1, v.s||0); });
        renderNew(); toast(cat.name+' marked safe','good'); }},'✓ All safe'),
      h('button',{title:'Clear this section', onclick:e=>{ e.stopPropagation();
        cat.items.forEach(it=>{ delete F.items[it.ref]; }); renderNew(); }},'Clear'));
    const hd = h('div',{class:'cat-h', onclick:()=>c.classList.toggle('open')},
      h('span',{class:'arr'},'▶'), h('span',{class:'nm'}, cat.id+'. '+cat.name), qa, badge);
    const bd = h('div',{class:'cat-b'});
    cat.items.forEach(it=>{
      if (it.off) return;
      const v = () => F.items[it.ref] || {s:0,r:0,remark:''};
      const ensure = () => { if(!F.items[it.ref]) F.items[it.ref]={s:0,r:0,remark:'',corrected:false,action:false,high:false}; return F.items[it.ref]; };
      const row = h('div',{class:'item'});
      const nS = h('span',{class:'n'}, String(v().s||0));
      const nR = h('span',{class:'n'}, String(v().r||0));
      const extra = h('div',{class:'item-extra', style:(v().s||v().r)?'':'display:none'});
      const remark = h('input',{type:'text', placeholder:'Remark (what was seen, correction done…)', value:v().remark||'', oninput:e=>{ensure().remark=e.target.value;}});
      const remarkMic = dictateButton(t=>{ const o=ensure(); o.remark = (o.remark? o.remark+' ' : '') + t; remark.value = o.remark; });
      const mkTgl = (label, key, cls) => {
        const t = h('label',{class:'tgl '+cls+(v()[key]?' on':'')},
          h('input',{type:'checkbox', ...(v()[key]?{checked:''}:{}), onchange:e=>{ ensure()[key]=e.target.checked; t.classList.toggle('on', e.target.checked); }}), label);
        return t;
      };
      const rebuildExtra = ()=>{
        extra.textContent='';
        extra.append(remark, remarkMic);
        if ((v().r||0)>0){
          extra.append(mkTgl('✓ Corrected on spot','corrected','ok'), mkTgl('⚙ Create action','action',''), mkTgl('⚠ High risk','high','hr'));
        }
      };
      rebuildExtra();
      const step = (which, delta, span) => {
        const o = ensure();
        o[which] = Math.max(0, (+o[which]||0)+delta);
        span.textContent = String(o[which]);
        if (which==='r' && o.r>0 && !('action' in o)) o.action=true;
        if (!o.s && !o.r && !o.remark) { delete F.items[it.ref]; extra.style.display='none'; }
        else extra.style.display='';
        rebuildExtra(); refreshBadge();
        updateSum();
      };
      row.append(
        h('span',{class:'ref'},it.ref),
        h('span',{class:'txt'},it.text),
        h('div',{class:'ctr'},
          h('span',{class:'step safe'}, h('span',{class:'tag'},'SAFE'), h('button',{type:'button', 'aria-label':'decrease safe', onclick:()=>step('s',-1,nS)},'–'), nS, h('button',{type:'button','aria-label':'increase safe', onclick:()=>step('s',1,nS)},'+')),
          h('span',{class:'step risk'}, h('span',{class:'tag'},'RISK'), h('button',{type:'button','aria-label':'decrease at-risk', onclick:()=>step('r',-1,nR)},'–'), nR, h('button',{type:'button','aria-label':'increase at-risk', onclick:()=>step('r',1,nR)},'+'))),
        extra);
      bd.append(row);
    });
    c.append(hd,bd); wrap.append(c);
  });
  V.append(wrap);

  function applyFilter(){
    const q = chkSearch.value.trim().toLowerCase();
    $$('.cat', wrap).forEach(cel=>{
      let shown = 0;
      $$('.item', cel).forEach(row=>{
        const txt = (row.textContent||'').toLowerCase();
        const hit = !q || txt.includes(q);
        row.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      cel.style.display = shown ? '' : 'none';
      if (q && shown) cel.classList.add('open');
    });
  }
  function drawRing(){
    const total = S.set.checklist.reduce((a,c)=>a+c.items.filter(i=>!i.off).length,0);
    const done = Object.keys(F.items).filter(k=>{ const v=F.items[k]; return (v.s||v.r); }).length;
    const pct = total ? done/total*100 : 0;
    ringWrap.textContent='';
    const r = 14, circ = 2*Math.PI*r;
    const svg = sv('svg',{class:'ring', viewBox:'0 0 34 34'});
    svg.append(sv('circle',{cx:17,cy:17,r, fill:'none', stroke:'var(--card3)','stroke-width':4}));
    svg.append(sv('circle',{cx:17,cy:17,r, fill:'none', stroke:'var(--safe)','stroke-width':4,'stroke-linecap':'round',
      'stroke-dasharray':circ, 'stroke-dashoffset':circ*(1-pct/100), transform:'rotate(-90 17 17)'}));
    ringWrap.append(svg, h('span',{}, done+' / '+total+' items marked'));
  }
  drawRing();

  /* summary bar */
  const sumS = h('b',{},'0'), sumR = h('b',{},'0'), sumP = h('b',{},'–');
  const bar = h('div',{class:'sumbar'},
    h('div',{class:'s safe'},'Total Safe',sumS),
    h('div',{class:'s risk'},'Total At Risk',sumR),
    h('div',{class:'s'},'% Safe',sumP),
    h('div',{class:'grow'}),
    h('label',{class:'tgl'+(F.feedback?' on ok':''), id:'fb-tgl'},
      h('input',{type:'checkbox', ...(F.feedback?{checked:''}:{}), onchange:e=>{F.feedback=e.target.checked; $('#fb-tgl').classList.toggle('on',e.target.checked); $('#fb-tgl').classList.toggle('ok',e.target.checked);}}),'Feedback discussed with person(s)'),
    h('button',{class:'btn ghost', onclick:()=>{ if(confirm('Clear the whole form?')){ F=blankForm(); renderNew(); } }},'Reset'),
    h('button',{class:'btn primary', onclick:saveObservation}, editing?'Update observation':'💾 Save observation'));
  V.append(bar);

  function updateSum(){
    const t = formTotals();
    sumS.textContent = fmtN(t.s); sumR.textContent = fmtN(t.r); sumP.textContent = t.pct==null?'–':fmtP(t.pct);
    drawRing();
  }
  window.updateSum = updateSum;
  updateSum();
}

function saveObservation(){
  const t = formTotals();
  const miss = [];
  if (!F.observer.trim()) miss.push('Observer name');
  if (!F.dept) miss.push('Department');
  if (!F.plant) miss.push('Plant / Unit');
  if (!F.location.trim()) miss.push('Location');
  if (!F.job.trim()) miss.push('Job description');
  if (!F.date) miss.push('Date');
  if (miss.length){ toast('Please fill: '+miss.join(', '),'warn'); return; }
  if (t.t===0){ toast('Mark at least one checklist item as Safe or At Risk','warn'); return; }

  const items = {};
  for (const k in F.items){ const v=F.items[k]; if (+v.s||+v.r||v.remark) items[k]={s:+v.s||0,r:+v.r||0,remark:v.remark||'',corrected:!!v.corrected,action:!!v.action,high:!!v.high}; }

  const core = {observer:F.observer.trim(), dept:F.dept, plant:F.plant, date:F.date, time:F.time, shift:F.shift,
    location:F.location.trim(), job:F.job.trim(), type:F.type, people:+F.people||1, feedback:!!F.feedback,
    photos:(F.photos||[]).slice(), items};
  let obs;
  if (F.id){
    obs = S.obs.find(o=>o.id===F.id);
    Object.assign(obs, core);
  } else {
    obs = Object.assign({ id:nextObsId(), createdAt:new Date().toISOString() }, core);
    S.obs.unshift(obs);
  }
  /* remember profile defaults */
  S.set.profile = { name:F.observer.trim(), dept:F.dept, plant:F.plant }; saveSet();

  /* auto-create corrective actions */
  let created = 0;
  for (const ref in items){
    const v = items[ref];
    if (v.r>0 && v.action && !S.actions.some(a=>a.obsId===obs.id && a.ref===ref)){
      const due = new Date(); due.setDate(due.getDate() + (v.high?3:7));
      S.actions.unshift({ id:nextActId(), obsId:obs.id, ref, desc:'['+ref+'] '+itemText(ref)+(v.remark?' — '+v.remark:''), dept:obs.dept, plant:obs.plant, assignee:'', due:due.toISOString().slice(0,10), priority:v.high?'High':'Medium', status:'Open', createdAt:new Date().toISOString(), closedOn:'', closure:'' });
      created++;
    }
  }
  saveObs(); saveAct(); updateCounts();
  const wasEdit = !!F.id;
  F = blankForm();
  toast((wasEdit?'Observation updated':'Observation '+obs.id+' saved')+(created?' · '+created+' corrective action(s) created':''),'good');
  showView('register');
  openObsDetail(obs.id);
}
