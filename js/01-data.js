/* ============================================================
   IGL BBS · 01-data.js
   Seed data, checklist, settings & localStorage layer
   ============================================================ */

/* =========================================================
   IGL BBS — Behaviour Based Safety
   India Glycols Limited · data layer
   ========================================================= */
'use strict';

const PORTAL_URL = 'https://iglsafetymanagementsystem.netlify.app/';
const APP_VER = '1.1.0';

/* ---- BBS observation checklist (as per IGL BBSO format) ---- */
const CHECKLIST_SEED = [
 {id:1, name:'Body Use & Position (Ergonomics)', items:[
  {ref:'1.1', text:'Uses proper body posture during work'},
  {ref:'1.2', text:'Avoids line of fire'},
  {ref:'1.3', text:'Maintains safe distance from hot surfaces/chemicals'},
  {ref:'1.4', text:'Avoids exposure to steam/chemicals'},
  {ref:'1.5', text:'Safe manual handling practices'},
  {ref:'1.6', text:'Safe positioning during operations/maintenance'},
  {ref:'1.7', text:'Avoids cramped/unstable positions'},
  {ref:'1.8', text:'Safe walking and climbing'}]},
 {id:2, name:'Personal Protective Equipment (PPE)', items:[
  {ref:'2.1', text:'Wears required PPE'},
  {ref:'2.2', text:'PPE complete and properly worn'},
  {ref:'2.3', text:'Uses task specific PPE'},
  {ref:'2.4', text:'PPE in good condition'},
  {ref:'2.5', text:'Uses special PPE in hazardous areas'}]},
 {id:3, name:'Tools & Equipment', items:[
  {ref:'3.1', text:'Uses correct tools'},
  {ref:'3.2', text:'Tools in good condition'},
  {ref:'3.3', text:'Equipment operated safely'},
  {ref:'3.4', text:'Guards/barriers in place'},
  {ref:'3.5', text:'No leakage from equipment'},
  {ref:'3.6', text:'Instruments functional'},
  {ref:'3.7', text:'Safe compressed air use'},
  {ref:'3.8', text:'Safe mobile/rotating equipment use'},
  {ref:'3.9', text:'Safe tanker/loading connections'},
  {ref:'3.10', text:'Containers/drums safe'}]},
 {id:4, name:'Working Environment', items:[
  {ref:'4.1', text:'Good housekeeping maintained'},
  {ref:'4.2', text:'No slip/trip hazards'},
  {ref:'4.3', text:'Walkways clear'},
  {ref:'4.4', text:'No dust/vapor accumulation'},
  {ref:'4.5', text:'No spillage'},
  {ref:'4.6', text:'Proper stacking/storage'},
  {ref:'4.7', text:'Adequate lighting/ventilation'},
  {ref:'4.8', text:'No obstruction'},
  {ref:'4.9', text:'Electrical safety maintained'}]},
 {id:5, name:'Chemical & Process Safety', items:[
  {ref:'5.1', text:'Safe chemical handling'},
  {ref:'5.2', text:'No incompatible mixing'},
  {ref:'5.3', text:'Proper labeling/storage'},
  {ref:'5.4', text:'Closed transfer system'},
  {ref:'5.5', text:'No chemical leakage'},
  {ref:'5.6', text:'Process within limits'},
  {ref:'5.7', text:'No ignition sources'},
  {ref:'5.8', text:'Safe hazardous material handling'},
  {ref:'5.9', text:'Reaction/pressure control'},
  {ref:'5.10', text:'Safe sampling/blending'}]},
 {id:6, name:'Procedure', items:[
  {ref:'6.1', text:'SOP available and followed'},
  {ref:'6.2', text:'PTW followed'},
  {ref:'6.3', text:'LOTO implemented'},
  {ref:'6.4', text:'Proper communication'},
  {ref:'6.5', text:'Supervision for critical tasks'},
  {ref:'6.6', text:'HIRA/JSA followed'}]},
 {id:7, name:'Behavioural', items:[
  {ref:'7.1', text:'Reports unsafe conditions'},
  {ref:'7.2', text:'No shortcuts'},
  {ref:'7.3', text:'Proper coordination'},
  {ref:'7.4', text:'Works with awareness'},
  {ref:'7.5', text:'Safe work pace'},
  {ref:'7.6', text:'Uses observation skills'}]},
 {id:8, name:'Fall Protection', items:[
  {ref:'8.1', text:'Uses fall protection'},
  {ref:'8.2', text:'Proper use of fall arrest'},
  {ref:'8.3', text:'Safe anchors/lifelines'},
  {ref:'8.4', text:'Safe ladders/scaffolds'},
  {ref:'8.5', text:'Equipment in good condition'},
  {ref:'8.6', text:'Barriers/edge protection'}]},
 {id:9, name:'Emergency', items:[
  {ref:'9.1', text:'Aware of emergency procedures'},
  {ref:'9.2', text:'Knows fire equipment location'},
  {ref:'9.3', text:'Knows isolation valves'},
  {ref:'9.4', text:'Knows spill response'},
  {ref:'9.5', text:'Knows fire safety'},
  {ref:'9.6', text:'Emergency equipment functional'}]},
 {id:10, name:'Transport', items:[
  {ref:'10.1', text:'Safe loading/unloading'},
  {ref:'10.2', text:'Vehicle/driver verified'},
  {ref:'10.3', text:'Loads secured'},
  {ref:'10.4', text:'No transport spillage'},
  {ref:'10.5', text:'Driver briefing done'},
  {ref:'10.6', text:'Transport compliance followed'}]},
 {id:11, name:'Others', items:[
  {ref:'11.1', text:'Mobile phone usage'}]}
];

const DEPTS_SEED = ['Production – MEG / Glycols','Production – EO Derivatives','Production – Ethoxylates','Production – Specialty Chemicals','Distillery / ENA','Power Plant & Utilities','Boiler House','Mechanical Maintenance','Electrical Maintenance','Instrumentation','Civil','Stores & Purchase','Laboratory / QC','EHS / Fire & Safety','HR & Administration','Security','Projects','Logistics / Despatch','Contractor'];
const PLANTS_SEED = ['MEG','EO / EOD','Glycol Ethers','Ethoxylates','Specialty Chemicals','Distillery / ENA','Power Plant','Boiler House','Utilities','ETP','Tank Farm','Warehouse','Loading Gantry','Laboratory','Workshop','Admin Block'];
const SHIFTS = ['General','A (06:00–14:00)','B (14:00–22:00)','C (22:00–06:00)'];

/* ---- storage (localStorage with in-memory fallback) ---- */
const store = (() => {
  let mem = {};
  let ok = false;
  try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); ok = true; } catch(e) { ok = false; }
  return {
    persistent: ok,
    get(k, d){ try { const v = ok ? localStorage.getItem(k) : mem[k]; return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ const s = JSON.stringify(v); if (ok) { try { localStorage.setItem(k, s); } catch(e){ mem[k] = s; } } else mem[k] = s; }
  };
})();

const K = { obs:'iglbbs.observations', act:'iglbbs.actions', set:'iglbbs.settings', chat:'iglbbs.chat', ai:'iglbbs.ailog' };

function defaultSettings(){
  return {
    checklist: JSON.parse(JSON.stringify(CHECKLIST_SEED)),
    departments: [...DEPTS_SEED],
    plants: [...PLANTS_SEED],
    shifts: [...SHIFTS],
    targetSafe: 95,
    monthlyTarget: 4,
    profile: { name:'', dept:'', plant:'' },
    openrouter: { key:'', model:'meta-llama/llama-3.3-70b-instruct:free', fallback:'', stream:true, visionModel:'google/gemini-2.5-flash' },
    theme:'dark', density:'comfortable', lang:'en',
    prompts:[],
    seeded: true
  };
}

/* First record — digitised from the IGL BBSO Excel sheet */
function seedObservation(){
  return {
    id:'BBS-0001', date:'2026-07-16', time:'11:00', shift:'General',
    observer:'Brajraj Singh', dept:'Production – MEG / Glycols', plant:'MEG',
    location:'Analyser House, MEG', job:'Carrier gas cylinder of selectivity GC',
    type:'Planned', people:1, feedback:true,
    items:{
      '1.1':{s:1,r:0,remark:''},
      '2.1':{s:0,r:1,remark:'One person not wearing helmet chin strap properly. It was corrected at site immediately after communication.',corrected:true,action:false,high:false},
      '3.1':{s:1,r:0,remark:''}, '3.2':{s:1,r:0,remark:''},
      '4.3':{s:1,r:0,remark:''},
      '7.2':{s:1,r:0,remark:''}, '7.3':{s:1,r:0,remark:''},
      '8.5':{s:1,r:0,remark:''}
    },
    createdAt:'2026-07-16T11:00:00'
  };
}

let S = {
  obs: store.get(K.obs, null),
  actions: store.get(K.act, []),
  set: store.get(K.set, null),
  chat: store.get(K.chat, []),
  ailog: store.get(K.ai, []),
  view: 'dashboard',
  dashF: { period:'l90', dept:'', plant:'' },
  anaF: { period:'all', dept:'', plant:'', observer:'' },
  regF: { q:'', dept:'', plant:'', from:'', to:'' },
  actF: { status:'', dept:'', q:'' },
  editId: null
};
if (!S.set) { S.set = defaultSettings(); store.set(K.set, S.set); }
/* migrate settings keys if older backup restored */
S.set = Object.assign(defaultSettings(), S.set);
if (!S.obs) { S.obs = [seedObservation()]; store.set(K.obs, S.obs); }

const saveObs = () => store.set(K.obs, S.obs);
const saveAct = () => store.set(K.act, S.actions);
const saveSet = () => store.set(K.set, S.set);
const saveChat = () => store.set(K.chat, S.chat);
const saveAiLog = () => store.set(K.ai, S.ailog.slice(-200));

/* ---- derived helpers ---- */
function obsTotals(o){
  let s=0, r=0;
  for (const k in (o.items||{})) { s += +o.items[k].s||0; r += +o.items[k].r||0; }
  const t = s + r;
  return { s, r, t, pct: t ? (s/t*100) : null };
}
function itemText(ref){
  for (const c of S.set.checklist) for (const it of c.items) if (it.ref===ref) return it.text;
  return ref;
}
function itemCat(ref){
  for (const c of S.set.checklist) for (const it of c.items) if (it.ref===ref) return c.name;
  return '';
}
/* demo records carry demo:true so they can be cleared in one click */
const demoCount = () => S.obs.filter(o=>o.demo).length;
const hasDemo = () => demoCount() > 0;

function nextObsId(){
  let m = 0;
  S.obs.forEach(o => { const n = parseInt(String(o.id).replace(/\D/g,''),10); if (n>m) m=n; });
  return 'BBS-' + String(m+1).padStart(4,'0');
}
function nextActId(){
  let m = 0;
  S.actions.forEach(a => { const n = parseInt(String(a.id).replace(/\D/g,''),10); if (n>m) m=n; });
  return 'ACT-' + String(m+1).padStart(4,'0');
}
