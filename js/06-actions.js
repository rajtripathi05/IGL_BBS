/* ============================================================
   IGL BBS · 06-actions.js
   Corrective actions (CAPA) tracker
   ============================================================ */

/* ================= Corrective Actions (CAPA) ================= */
const ACT_STATUS = ['Open','In Progress','Closed'];
function actChip(a){
  const od = a.status!=='Closed' && a.due && a.due<todayStr();
  if (od) return h('span',{class:'chip crit'},'! Overdue');
  if (a.status==='Closed') return h('span',{class:'chip good'},'✓ Closed');
  if (a.status==='In Progress') return h('span',{class:'chip info'},'● In Progress');
  return h('span',{class:'chip warn'},'⚠ Open');
}
function renderActions(){
  const V = $('#view-actions'); V.textContent='';
  const f = S.actF;

  const open = S.actions.filter(a=>a.status==='Open').length;
  const prog = S.actions.filter(a=>a.status==='In Progress').length;
  const over = S.actions.filter(a=>a.status!=='Closed' && a.due && a.due<todayStr()).length;
  const closed = S.actions.filter(a=>a.status==='Closed').length;
  const kp = h('div',{class:'kpis'});
  [['Open',open,'warn'],['In progress',prog,'info'],['Overdue',over,'crit'],['Closed',closed,'good']].forEach(([l,v,c])=>{
    kp.append(h('div',{class:'kpi'},h('div',{class:'l'},l),h('div',{class:'v', style:c==='crit'&&v?'color:var(--crit)':''},fmtN(v))));
  });
  V.append(kp);

  V.append(h('div',{class:'filters'},
    fWrap('Search', h('input',{type:'search', placeholder:'Description, assignee…', value:f.q, oninput:e=>{S.actF.q=e.target.value; draw();}})),
    fWrap('Status', selEl([['','All'],['Open','⚠ Open'],['In Progress','● In Progress'],['Closed','✓ Closed'],['Overdue','! Overdue']], f.status, v=>{S.actF.status=v; draw();})),
    fWrap('Department', selEl(S.set.departments, f.dept, v=>{S.actF.dept=v; draw();}, 'All')),
    h('div',{style:'flex:1'}),
    h('button',{class:'btn sm', onclick:()=>aiOutputModal('Corrective action review', d=>aiActionReview(d))},'✦ AI review'),
    h('button',{class:'btn sm primary', onclick:()=>openActionModal(null)},'+ New action')));

  const db = demoBar(); if (db) V.append(db);
  const mount = h('div',{}); V.append(mount);
  S.actState = S.actState || { sort:{key:'due', dir:'asc'}, page:1, sel:new Set() };
  const st = S.actState; st.rerender = draw;
  function draw(){
    mount.textContent='';
    let list = [...S.actions];
    const ff = S.actF;
    if (ff.status==='Overdue') list = list.filter(a=>a.status!=='Closed' && a.due && a.due<todayStr());
    else if (ff.status) list = list.filter(a=>a.status===ff.status);
    if (ff.dept) list = list.filter(a=>a.dept===ff.dept);
    if (ff.q){ const q=ff.q.toLowerCase(); list = list.filter(a=>(a.id+' '+a.desc+' '+(a.assignee||'')+' '+(a.obsId||'')).toLowerCase().includes(q)); }
    list.sort((a,b)=>{
      const ao = a.status==='Closed'?1:0, bo = b.status==='Closed'?1:0;
      if (ao!==bo) return ao-bo;
      return (a.due||'9999').localeCompare(b.due||'9999');
    });
    if (!list.length){ mount.append(h('div',{class:'card empty'},
      h('div',{class:'big'},'✅'), h('h4',{},'Nothing here'),
      h('p',{},'No corrective actions match these filters. Actions are created automatically when an at-risk item is flagged during an observation.'))); return; }

    st.sel = new Set([...st.sel].filter(id=>list.some(a=>a.id===id)));
    if (st.sel.size){
      mount.append(h('div',{class:'bulkbar'},
        h('b',{}, fmtN(st.sel.size)+' selected'), h('span',{style:'flex:1'}),
        h('button',{class:'btn sm', onclick:()=>{
          const note = prompt('Closure remark for the selected action(s):','Verified at site');
          if (note===null) return;
          const snap = JSON.parse(JSON.stringify(S.actions));
          let n=0, skipped=0;
          S.actions.forEach(a=>{ if(!st.sel.has(a.id)) return;
            if (a.status==='Closed'){ skipped++; return; }
            a.status='Closed'; a.closedOn=todayStr(); a.closure=note; n++; });
          st.sel=new Set(); saveAct(); updateCounts(); renderActions();
          if (!n) toast(skipped ? 'Already closed — nothing to change' : 'Nothing to close','warn');
          else toastUndo(n+' action(s) closed'+(skipped? ' ('+skipped+' already closed)':''),
            ()=>{ S.actions=snap; saveAct(); updateCounts(); renderActions(); });
        }},'✓ Close selected'),
        h('button',{class:'btn sm', onclick:()=>{
          const who = prompt('Assign the selected action(s) to:');
          if (!who) return;
          S.actions.forEach(a=>{ if(st.sel.has(a.id)) a.assignee=who; });
          st.sel=new Set(); saveAct(); renderActions(); toast('Assigned to '+who,'good');
        }},'👤 Assign'),
        h('button',{class:'btn sm', onclick:()=>{ st.sel=new Set(); draw(); }},'Clear'),
        h('button',{class:'btn sm danger', onclick:()=>{
          if (!confirm('Delete '+st.sel.size+' action(s)?')) return;
          const snap = S.actions.slice(); const n = st.sel.size;
          S.actions = S.actions.filter(a=>!st.sel.has(a.id));
          st.sel=new Set(); saveAct(); updateCounts(); draw();
          toastUndo(n+' action(s) deleted', ()=>{ S.actions=snap; saveAct(); updateCounts(); draw(); });
        }},'🗑 Delete')));
    }

    const cols = [
      {key:'id', label:'ID', get:a=>a.id, cell:a=>h('span',{class:'strong'},a.id)},
      {key:'status', label:'Status', get:a=>(a.status!=='Closed'&&a.due&&a.due<todayStr())?'0':(a.status==='Open'?'1':a.status==='In Progress'?'2':'3'), cell:a=>actChip(a)},
      {key:'desc', label:'Description', get:a=>a.desc, cell:a=>h('span',{}, a.desc.length>95? a.desc.slice(0,94)+'…' : a.desc)},
      {key:'obsId', label:'Source', get:a=>a.obsId||'Manual'},
      {key:'dept', label:'Department', get:a=>a.dept||''},
      {key:'assignee', label:'Assigned to', get:a=>a.assignee||''},
      {key:'due', label:'Due', get:a=>a.due||'9999', cell:a=>h('span',{style:(a.status!=='Closed'&&a.due&&a.due<todayStr())?'color:var(--crit);font-weight:700':''}, a.due?dLabel(a.due):'–')},
      {key:'priority', label:'Priority', get:a=>({High:0,Medium:1,Low:2})[a.priority]??3, cell:a=>h('span',{class:'chip '+(a.priority==='High'?'crit':a.priority==='Low'?'mut':'warn')}, a.priority)}
    ];
    mount.append(dataTable({cols, rows:list, state:st, selectable:true,
      onRow:{click:a=>openActionModal(a.id)}, onSelect:()=>draw(), pageSize:25}));
  }
  draw();
}

function openActionModal(id){
  const a = id ? S.actions.find(x=>x.id===id) : { id:null, desc:'', dept:S.set.profile.dept||'', plant:'', assignee:'', due:'', priority:'Medium', status:'Open', obsId:'', ref:'', closure:'', closedOn:'' };
  if (!a) return;
  const w = JSON.parse(JSON.stringify(a));
  const body = h('div',{class:'grid', style:'gap:12px'});
  const field = (label, ctrl) => h('div',{}, h('label',{},label), ctrl);
  const desc = h('textarea',{oninput:e=>w.desc=e.target.value}, w.desc);
  body.append(field('Description *', desc));
  const row1 = h('div',{class:'grid g3'});
  row1.append(
    field('Department', selEl(S.set.departments, w.dept, v=>w.dept=v, '—')),
    field('Plant', selEl(S.set.plants, w.plant, v=>w.plant=v, '—')),
    field('Assigned to', h('input',{type:'text', value:w.assignee||'', oninput:e=>w.assignee=e.target.value, placeholder:'Name / role'})));
  const row2 = h('div',{class:'grid g3'});
  row2.append(
    field('Due date', h('input',{type:'date', value:w.due||'', onchange:e=>w.due=e.target.value})),
    field('Priority', selEl(['High','Medium','Low'], w.priority, v=>w.priority=v)),
    field('Status', selEl(ACT_STATUS, w.status, v=>w.status=v)));
  body.append(row1,row2);
  body.append(field('Closure remarks', h('textarea',{oninput:e=>w.closure=e.target.value, placeholder:'How was it closed / verified?'}, w.closure||'')));
  if (w.obsId) body.append(h('div',{class:'note'},'Source: observation '+w.obsId+(w.ref?' · item '+w.ref+' — '+itemText(w.ref):''),' ', h('a',{href:'#', onclick:e=>{e.preventDefault(); modal.close(); openObsDetail(w.obsId);}},'view')));

  modal.open({ title: id ? 'Action '+id : 'New corrective action', body, foot:[
    ...(id?[h('button',{class:'btn sm danger', onclick:()=>{ if(!confirm('Delete this action?'))return; S.actions=S.actions.filter(x=>x.id!==id); saveAct(); updateCounts(); modal.close(); renderActions(); toast('Action deleted'); }},'Delete')]:[]),
    h('button',{class:'btn sm', onclick:()=>modal.close()},'Cancel'),
    h('button',{class:'btn sm primary', onclick:()=>{
      if (!w.desc.trim()){ toast('Description is required','warn'); return; }
      if (w.status==='Closed' && !w.closedOn) w.closedOn = todayStr();
      if (w.status!=='Closed') w.closedOn = '';
      if (id) Object.assign(S.actions.find(x=>x.id===id), w);
      else { w.id = nextActId(); w.createdAt = new Date().toISOString(); S.actions.unshift(w); }
      saveAct(); updateCounts(); modal.close(); renderActions(); toast(id?'Action updated':'Action created','good');
    }},'💾 Save')
  ]});
}
