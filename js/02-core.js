/* ============================================================
   IGL BBS · 02-core.js
   DOM helpers, SVG chart engine, filters & router
   ============================================================ */

/* ================= utils ================= */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
function h(tag, attrs={}, ...kids){
  const ns = tag==='svg'||attrs.__svg ? 'http://www.w3.org/2000/svg' : null;
  const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k==='__svg') continue;
    if (k==='class') el.setAttribute('class', v);
    else if (k==='text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v!==null && v!==undefined) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()){
    if (kid==null) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
const sv = (tag, attrs={}, ...kids) => h(tag, {...attrs, __svg:1}, ...kids);
const fmtN = n => (n==null||isNaN(n)) ? '–' : Number(n).toLocaleString('en-IN');
const fmtP = n => (n==null||isNaN(n)) ? '–' : (Math.round(n*10)/10) + '%';
const todayStr = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const nowTime = () => { const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const mKey = ds => ds ? ds.slice(0,7) : '';
const mLabel = k => { const [y,m]=k.split('-'); return MONTHS[+m-1]+" '"+y.slice(2); };
const dLabel = ds => { if(!ds) return '–'; const [y,m,d]=ds.split('-'); return d+' '+MONTHS[+m-1]+' '+y.slice(2); };
function toast(msg, kind){
  const t = h('div',{class:'toast '+(kind||'')}, msg);
  $('#toasts').append(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),320); }, 3600);
}
function pctBand(p){
  const tgt = S.set.targetSafe || 95;
  if (p==null) return {cls:'mut', icon:'·', label:'–'};
  if (p >= tgt) return {cls:'good', icon:'✓', label:fmtP(p)};
  if (p >= 80)  return {cls:'warn', icon:'▲', label:fmtP(p)};
  return {cls:'crit', icon:'!', label:fmtP(p)};
}

/* ================= tooltip ================= */
const tip = {
  el: null,
  show(x, y, title, rows){
    const t = this.el; t.textContent='';
    if (title) t.append(h('div',{class:'tt'}, title));
    for (const r of rows){
      const row = h('div',{class:'row'});
      if (r.color) row.append(h('span',{class:'key', style:'background:'+r.color}));
      row.append(h('span',{class:'val'}, r.val), h('span',{class:'lab'}, r.lab||''));
      t.append(row);
    }
    t.style.display='block';
    const w = t.offsetWidth, hh = t.offsetHeight;
    let px = x+14, py = y+14;
    if (px+w > innerWidth-8) px = x-w-14;
    if (py+hh > innerHeight-8) py = y-hh-14;
    t.style.left=px+'px'; t.style.top=py+'px';
  },
  hide(){ this.el.style.display='none'; }
};

/* ================= SVG charts =================
   specs: bars ≤24px, 4px rounded data-end (square baseline),
   2px lines, ≥8px markers w/ 2px surface ring, 2px surface gaps,
   hairline solid grid, tooltips on hover+focus. */
const CH = { safe:'#3987E5', risk:'#E66767', grid:'#1E3A55', axis:'#2A4A68', mut:'#7E97AC', ink2:'#B9CCDD', surface:'#10283F' };

/* Heat ramps for the category x month heatmap — one hue, monotone light->dark.
   Validated for lightness monotonicity + single hue in both modes. */
const HEAT = {
  dark:  ['#16324B','#4A2226','#7A2B2B','#C9403F','#EF7A72','#F9B3AE'],
  light: ['#F4F7FA','#FBD5D2','#F39C95','#E34948','#B52F2F','#7A1C1C']
};
/* read live token values so charts follow the theme */
function syncChartColors(){
  const cs = getComputedStyle(document.documentElement);
  const v = n => (cs.getPropertyValue(n)||'').trim();
  CH.safe = v('--safe') || CH.safe;
  CH.risk = v('--risk') || CH.risk;
  CH.grid = v('--grid') || CH.grid;
  CH.mut  = v('--mut')  || CH.mut;
  CH.ink2 = v('--ink2') || CH.ink2;
  CH.surface = v('--card') || CH.surface;
  CH.axis = v('--line2') ? (isLight() ? '#C6D3DF' : '#2A4A68') : CH.axis;
  CH.heat = isLight() ? HEAT.light : HEAT.dark;
}
const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

function niceTicks(max, n=4){
  if (max<=0) max = 1;
  const raw = max/n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw/mag;
  const step = (norm<=1?1:norm<=2?2:norm<=5?5:10)*mag;
  const ticks = []; for (let v=0; v<=max+step*0.001; v+=step) ticks.push(Math.round(v*100)/100);
  return ticks;
}
function roundTopPath(x,y,w,hh,r,horiz){
  r = Math.min(r, w/2, Math.max(0,hh));
  if (hh<=0.5) return '';
  if (!horiz) return `M${x},${y+hh} L${x},${y+r} Q${x},${y} ${x+r},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+hh} Z`;
  r = Math.min(4, hh/2, w);
  return `M${x},${y} L${x+w-r},${y} Q${x+w},${y} ${x+w},${y+r} L${x+w},${y+hh-r} Q${x+w},${y+hh} ${x+w-r},${y+hh} L${x},${y+hh} Z`;
}

/* vertical columns: data [{label, value, hint}] */
function colChart(mount, {data, color=CH.safe, height=210, fmt=fmtN, unit=''}){
  mount.textContent='';
  if (!data.length){ mount.append(h('div',{class:'empty'},'No data for this period')); return; }
  const W=640, Hh=height, padL=40, padR=10, padT=14, padB=26;
  const iw = W-padL-padR, ihh = Hh-padT-padB;
  const max = Math.max(...data.map(d=>d.value), 1);
  const ticks = niceTicks(max);
  const tmax = ticks[ticks.length-1];
  const svg = sv('svg',{viewBox:`0 0 ${W} ${Hh}`, role:'img'});
  ticks.forEach(tk=>{
    const y = padT + ihh - (tk/tmax)*ihh;
    svg.append(sv('line',{x1:padL,x2:W-padR,y1:y,y2:y,stroke:CH.grid,'stroke-width':1}));
    svg.append(sv('text',{x:padL-6,y:y+3.5,'text-anchor':'end','font-size':10,fill:CH.mut,style:'font-variant-numeric:tabular-nums'}, fmtN(tk)));
  });
  const slot = iw/data.length, bw = Math.min(24, slot*0.55);
  data.forEach((d,i)=>{
    const x = padL + slot*i + (slot-bw)/2;
    const bh = (d.value/tmax)*ihh, y = padT+ihh-bh;
    const g = sv('g',{class:'bar-hit', tabindex:0, role:'listitem','aria-label':`${d.label}: ${fmt(d.value)}${unit}`});
    g.append(sv('rect',{x:padL+slot*i, y:padT, width:slot, height:ihh, fill:'transparent'}));
    if (d.value>0) g.append(sv('path',{d:roundTopPath(x,y,bw,bh,4,false), fill:color, class:'bar-fill'}));
    const ev = e => { const p = e.touches?e.touches[0]:e; tip.show(p.clientX,p.clientY,d.label,[{color, val:fmt(d.value)+unit, lab:d.hint||''}]); };
    g.addEventListener('pointermove', ev);
    g.addEventListener('focus', ()=>{ const r=g.getBoundingClientRect(); tip.show(r.left+r.width/2,r.top,d.label,[{color,val:fmt(d.value)+unit,lab:d.hint||''}]); });
    g.addEventListener('pointerleave', ()=>tip.hide()); g.addEventListener('blur', ()=>tip.hide());
    svg.append(g);
    if (data.length<=14) svg.append(sv('text',{x:padL+slot*i+slot/2, y:Hh-8,'text-anchor':'middle','font-size':10,fill:CH.mut}, d.label));
  });
  mount.append(svg);
}

/* horizontal bars: data [{label, value, hint}] — value at tip */
function hbarChart(mount, {data, color=CH.safe, fmt=fmtN, unit='', maxLabel=26, refLine=null}){
  mount.textContent='';
  if (!data.length){ mount.append(h('div',{class:'empty'},'No data for this period')); return; }
  const rowH=30, W=640, padL=180, padR=52, padT=6, padB=refLine!=null?20:8;
  const Hh = padT+padB+data.length*rowH;
  const iw = W-padL-padR;
  const max = refLine!=null ? Math.max(...data.map(d=>d.value), refLine.value, 1) : Math.max(...data.map(d=>d.value), 1);
  const svg = sv('svg',{viewBox:`0 0 ${W} ${Hh}`, role:'img'});
  svg.append(sv('line',{x1:padL,x2:padL,y1:padT,y2:Hh-padB,stroke:CH.axis,'stroke-width':1}));
  data.forEach((d,i)=>{
    const y = padT+rowH*i, bh = Math.min(24, rowH-8), by = y+(rowH-bh)/2;
    const bw = (d.value/max)*iw;
    const lab = d.label.length>maxLabel ? d.label.slice(0,maxLabel-1)+'…' : d.label;
    const g = sv('g',{class:'bar-hit', tabindex:0, 'aria-label':`${d.label}: ${fmt(d.value)}${unit}`});
    g.append(sv('rect',{x:0,y,width:W,height:rowH,fill:'transparent'}));
    g.append(sv('text',{x:padL-8,y:y+rowH/2+3.5,'text-anchor':'end','font-size':11,fill:CH.ink2}, lab));
    if (d.value>0) g.append(sv('path',{d:roundTopPath(padL,by,bw,bh,4,true), fill:color, class:'bar-fill'}));
    g.append(sv('text',{x:padL+bw+6,y:y+rowH/2+3.5,'font-size':10.5,fill:CH.mut,style:'font-variant-numeric:tabular-nums'}, fmt(d.value)+unit));
    const ev = e => { const p=e.touches?e.touches[0]:e; tip.show(p.clientX,p.clientY,d.label,[{color, val:fmt(d.value)+unit, lab:d.hint||''}]); };
    g.addEventListener('pointermove', ev);
    g.addEventListener('focus', ()=>{ const r=g.getBoundingClientRect(); tip.show(r.left+r.width/2,r.top,d.label,[{color,val:fmt(d.value)+unit,lab:d.hint||''}]); });
    g.addEventListener('pointerleave', ()=>tip.hide()); g.addEventListener('blur', ()=>tip.hide());
    svg.append(g);
  });
  if (refLine!=null){
    const x = padL + (refLine.value/max)*iw;
    svg.append(sv('line',{x1:x,x2:x,y1:padT,y2:Hh-padB+4,stroke:CH.ink2,'stroke-width':1.5,'stroke-dasharray':null}));
    svg.append(sv('text',{x, y:Hh-6,'text-anchor':'middle','font-size':9.5,fill:CH.mut}, refLine.label));
  }
  mount.append(svg);
}

/* horizontal stacked 2-series (Safe / At-Risk) with 2px surface gaps */
function stackChart(mount, {rows, aName='Safe', bName='At Risk', fmt=fmtN, maxLabel=26}){
  mount.textContent='';
  if (!rows.length){ mount.append(h('div',{class:'empty'},'No data for this period')); return; }
  const rowH=30, W=640, padL=180, padR=60, padT=4, padB=6;
  const Hh = padT+padB+rows.length*rowH;
  const iw = W-padL-padR;
  const max = Math.max(...rows.map(r=>r.a+r.b), 1);
  const svg = sv('svg',{viewBox:`0 0 ${W} ${Hh}`, role:'img'});
  rows.forEach((r,i)=>{
    const y = padT+rowH*i, bh=Math.min(22, rowH-8), by=y+(rowH-bh)/2;
    const aw = (r.a/max)*iw, bw = (r.b/max)*iw;
    const lab = r.label.length>maxLabel ? r.label.slice(0,maxLabel-1)+'…' : r.label;
    const tot = r.a+r.b, pct = tot? Math.round(r.a/tot*1000)/10 : null;
    const g = sv('g',{class:'bar-hit', tabindex:0, 'aria-label':`${r.label}: ${aName} ${r.a}, ${bName} ${r.b}`});
    g.append(sv('rect',{x:0,y,width:W,height:rowH,fill:'transparent'}));
    g.append(sv('text',{x:padL-8,y:y+rowH/2+3.5,'text-anchor':'end','font-size':11,fill:CH.ink2}, lab));
    if (aw>0.5) g.append(sv('rect',{x:padL,y:by,width:Math.max(0,aw-1),height:bh,rx:3,fill:CH.safe,class:'bar-fill'}));
    if (bw>0.5) g.append(sv('rect',{x:padL+aw+1,y:by,width:Math.max(0.5,bw-1),height:bh,rx:3,fill:CH.risk,class:'bar-fill'}));
    /* in-segment % label only if it fits comfortably (~34px) */
    if (aw>40 && pct!=null) g.append(sv('text',{x:padL+aw/2,y:y+rowH/2+3.5,'text-anchor':'middle','font-size':10,fill:'#04121E','font-weight':700}, pct+'%'));
    g.append(sv('text',{x:padL+aw+bw+6,y:y+rowH/2+3.5,'font-size':10,fill:CH.mut,style:'font-variant-numeric:tabular-nums'}, fmtN(tot)));
    const ev = e => { const p=e.touches?e.touches[0]:e; tip.show(p.clientX,p.clientY,r.label,[
      {color:CH.safe, val:fmtN(r.a), lab:aName},
      {color:CH.risk, val:fmtN(r.b), lab:bName},
      {val:pct!=null?pct+'%':'–', lab:'% safe'}]); };
    g.addEventListener('pointermove', ev);
    g.addEventListener('focus', ()=>{ const rc=g.getBoundingClientRect(); tip.show(rc.left+rc.width/2,rc.top,r.label,[{color:CH.safe,val:fmtN(r.a),lab:aName},{color:CH.risk,val:fmtN(r.b),lab:bName}]); });
    g.addEventListener('pointerleave', ()=>tip.hide()); g.addEventListener('blur', ()=>tip.hide());
    svg.append(g);
  });
  mount.append(svg);
}
/* heatmap: rows x cols grid of magnitudes — sequential single-hue ramp + scale legend.
   Every value is also in the analyser's tables (the WCAG-clean twin). */
function heatmap(mount, {rows, cols, get, fmt=fmtN, label='value'}){
  mount.textContent='';
  if (!rows.length || !cols.length){ mount.append(h('div',{class:'empty'},'No data for this period')); return; }
  const ramp = CH.heat || HEAT.dark;
  const vals = [];
  rows.forEach(r=>cols.forEach(c=>{ const v=get(r,c); if(v>0) vals.push(v); }));
  const max = Math.max(1, ...vals);
  const cw = 42, ch = 26, padL = 178, padT = 22, gap = 2;
  const W = padL + cols.length*cw + 8, Hh = padT + rows.length*ch + 6;
  const svg = sv('svg',{viewBox:`0 0 ${W} ${Hh}`, role:'img','aria-label':'Heatmap of '+label});
  cols.forEach((c,i)=>svg.append(sv('text',{x:padL+i*cw+cw/2, y:padT-8,'text-anchor':'middle','font-size':10, fill:CH.mut}, c.label)));
  rows.forEach((r,ri)=>{
    const y = padT + ri*ch;
    const nm = r.label.length>26 ? r.label.slice(0,25)+'…' : r.label;
    svg.append(sv('text',{x:padL-9, y:y+ch/2+3.5,'text-anchor':'end','font-size':11, fill:CH.ink2}, nm));
    cols.forEach((c,ci)=>{
      const v = get(r,c) || 0;
      const idx = v<=0 ? 0 : Math.min(ramp.length-1, 1+Math.floor((v/max)*(ramp.length-1.001)));
      const g = sv('g',{class:'hm-cell', tabindex:0,'aria-label':`${r.label}, ${c.label}: ${fmt(v)}`});
      g.append(sv('rect',{x:padL+ci*cw, y:y+gap/2, width:cw-gap, height:ch-gap, rx:3, fill:ramp[idx]}));
      if (v>0 && cw>=34) g.append(sv('text',{x:padL+ci*cw+(cw-gap)/2, y:y+ch/2+3.5,'text-anchor':'middle','font-size':10,
        fill: idx>=ramp.length-2 ? '#fff' : (isLight()? '#0B1F33' : '#EAF2FA'),'font-weight':700}, fmt(v)));
      const show = e => { const p=e.touches?e.touches[0]:e; tip.show(p.clientX,p.clientY, r.label+' · '+c.label, [{val:fmt(v), lab:label}]); };
      g.addEventListener('pointermove', show);
      g.addEventListener('focus', ()=>{ const rc=g.getBoundingClientRect(); tip.show(rc.left+rc.width/2, rc.top, r.label+' · '+c.label, [{val:fmt(v), lab:label}]); });
      g.addEventListener('pointerleave', ()=>tip.hide()); g.addEventListener('blur', ()=>tip.hide());
      svg.append(g);
    });
  });
  mount.append(svg);
  const lg = h('div',{class:'hm-legend'}, 'low');
  ramp.slice(1).forEach(c=>lg.append(h('span',{class:'sw', style:'background:'+c})));
  lg.append('high · '+label);
  mount.append(lg);
}

function legend(pairs){
  const L = h('div',{class:'legend'});
  pairs.forEach(p=>L.append(h('span',{class:'li'}, h('span',{class:p.line?'ln':'sw', style:'background:'+p.color}), p.name)));
  return L;
}

/* line chart with crosshair tooltip; points [{label, y}] ; y in % or count */
function lineChart(mount, {points, color=CH.safe, height=210, fmt=v=>fmtP(v), yMax=100, yMin=0, target=null}){
  mount.textContent='';
  if (points.length<1){ mount.append(h('div',{class:'empty'},'No data for this period')); return; }
  const W=640, Hh=height, padL=42, padR=16, padT=12, padB=26;
  const iw=W-padL-padR, ihh=Hh-padT-padB;
  let lo=yMin, hi=yMax;
  if (yMax==null){ hi = Math.max(...points.map(p=>p.y||0),1)*1.15; lo = 0; }
  const X = i => points.length===1 ? padL+iw/2 : padL + (i/(points.length-1))*iw;
  const Y = v => padT + ihh - ((v-lo)/(hi-lo))*ihh;
  const svg = sv('svg',{viewBox:`0 0 ${W} ${Hh}`, role:'img', style:'touch-action:none'});
  const yt = yMax===100 ? [0,25,50,75,100] : niceTicks(hi);
  yt.forEach(tk=>{
    svg.append(sv('line',{x1:padL,x2:W-padR,y1:Y(tk),y2:Y(tk),stroke:CH.grid,'stroke-width':1}));
    svg.append(sv('text',{x:padL-6,y:Y(tk)+3.5,'text-anchor':'end','font-size':10,fill:CH.mut,style:'font-variant-numeric:tabular-nums'}, yMax===100?tk+'%':fmtN(tk)));
  });
  const step = Math.max(1, Math.ceil(points.length/8));
  points.forEach((p,i)=>{ if(i%step===0||i===points.length-1) svg.append(sv('text',{x:X(i),y:Hh-8,'text-anchor':'middle','font-size':10,fill:CH.mut}, p.label)); });
  if (target!=null){
    svg.append(sv('line',{x1:padL,x2:W-padR,y1:Y(target),y2:Y(target),stroke:CH.ink2,'stroke-width':1}));
    svg.append(sv('text',{x:padL+4,y:Y(target)-4,'text-anchor':'start','font-size':9.5,fill:CH.mut}, 'Target '+target+'%'));
  }
  const vals = points.filter(p=>p.y!=null);
  if (vals.length){
    let dParts=[], areaParts=[];
    let started=false;
    points.forEach((p,i)=>{
      if (p.y==null){ started=false; return; }
      const cmd = started?'L':'M';
      dParts.push(`${cmd}${X(i)},${Y(p.y)}`); started=true;
    });
    svg.append(sv('path',{d:dParts.join(' '), fill:'none', stroke:color,'stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'}));
    /* area wash ~10% for single series */
    let ai=points.findIndex(p=>p.y!=null), bi=points.length-1; while(bi>=0&&points[bi].y==null)bi--;
    if (ai>=0 && bi>ai){
      const seg = points.map((p,i)=>({p,i})).filter(o=>o.p.y!=null);
      const dA = 'M'+seg.map(o=>`${X(o.i)},${Y(o.p.y)}`).join(' L ')+` L${X(seg[seg.length-1].i)},${padT+ihh} L${X(seg[0].i)},${padT+ihh} Z`;
      svg.append(sv('path',{d:dA, fill:color, opacity:0.1}));
    }
    /* end-dot ≥8px with 2px surface ring */
    const last = points.map((p,i)=>({p,i})).filter(o=>o.p.y!=null).pop();
    if (last){
      svg.append(sv('circle',{cx:X(last.i),cy:Y(last.p.y),r:6,fill:color,stroke:CH.surface,'stroke-width':2}));
      svg.append(sv('text',{x:X(last.i)-8,y:Y(last.p.y)-9,'text-anchor':'end','font-size':10.5,fill:CH.ink2,'font-weight':700}, fmt(last.p.y)));
    }
  }
  /* crosshair */
  const cross = sv('line',{y1:padT,y2:padT+ihh,stroke:CH.axis,'stroke-width':1,visibility:'hidden'});
  const dot = sv('circle',{r:5,fill:color,stroke:CH.surface,'stroke-width':2,visibility:'hidden'});
  svg.append(cross,dot);
  svg.append(sv('rect',{x:padL,y:padT,width:iw,height:ihh,fill:'transparent',style:'cursor:crosshair'}));
  svg.addEventListener('pointermove', e=>{
    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX-rect.left)*(W/rect.width);
    let idx = points.length===1?0:Math.round((sx-padL)/(iw/(points.length-1)));
    idx = Math.max(0, Math.min(points.length-1, idx));
    const p = points[idx];
    cross.setAttribute('x1',X(idx)); cross.setAttribute('x2',X(idx)); cross.setAttribute('visibility','visible');
    if (p.y!=null){ dot.setAttribute('cx',X(idx)); dot.setAttribute('cy',Y(p.y)); dot.setAttribute('visibility','visible'); }
    else dot.setAttribute('visibility','hidden');
    tip.show(e.clientX, e.clientY, p.label, [{color, val:p.y!=null?fmt(p.y):'–', lab:p.lab||''}, ...(p.extra||[]).map(x=>({val:x.val, lab:x.lab}))]);
  });
  svg.addEventListener('pointerleave', ()=>{ cross.setAttribute('visibility','hidden'); dot.setAttribute('visibility','hidden'); tip.hide(); });
  mount.append(svg);
}

function sparkline(values, color=CH.safe, w=90, hh=26){
  const svg = sv('svg',{viewBox:`0 0 ${w} ${hh}`, style:`width:${w}px;height:${hh}px`});
  const vals = values.filter(v=>v!=null);
  if (vals.length<2){ return svg; }
  const max = Math.max(...vals), min = Math.min(...vals);
  const X = i => 2 + (i/(values.length-1))*(w-8);
  const Y = v => max===min ? hh/2 : 3 + (1-(v-min)/(max-min))*(hh-8);
  let d='', st=false;
  values.forEach((v,i)=>{ if(v==null){st=false;return;} d += (st?'L':'M')+X(i)+','+Y(v)+' '; st=true; });
  svg.append(sv('path',{d, fill:'none', stroke:'#3E5D7A','stroke-width':1.6,'stroke-linecap':'round'}));
  const li = values.length-1;
  if (values[li]!=null) svg.append(sv('circle',{cx:X(li),cy:Y(values[li]),r:3,fill:color,stroke:CH.surface,'stroke-width':2}));
  return svg;
}
function meterEl(pct, target){
  const m = h('div',{class:'meter'});
  const fill = h('div',{class:'fill', style:'width:'+Math.max(0,Math.min(100,pct||0))+'%'});
  m.append(fill);
  if (target!=null) m.append(h('div',{class:'tgt','data-l':'Target '+target+'%', style:'left:'+target+'%'}));
  return m;
}

/* ================= table utilities ================= */
/* Sortable, paginated table. cols: [{key,label,num?,get,cell?,sort?}] */
function dataTable({cols, rows, state, onRow, pageSize=25, selectable=false, onSelect}){
  const wrap = h('div',{});
  state.sort = state.sort || {};
  const dir = state.sort.dir || 'desc';
  if (state.sort.key){
    const col = cols.find(c=>c.key===state.sort.key);
    if (col){
      const val = r => col.sort ? col.sort(r) : col.get(r);
      rows = rows.slice().sort((a,b)=>{
        const x=val(a), y=val(b);
        const c = (typeof x==='number'&&typeof y==='number') ? x-y : String(x??'').localeCompare(String(y??''));
        return dir==='asc' ? c : -c;
      });
    }
  }
  const pages = Math.max(1, Math.ceil(rows.length/pageSize));
  state.page = Math.min(Math.max(1, state.page||1), pages);
  const slice = rows.slice((state.page-1)*pageSize, state.page*pageSize);

  const tw = h('div',{class:'tbl-wrap'});
  const tb = h('table',{});
  const hr = h('tr',{});
  if (selectable){
    const all = slice.length>0 && slice.every(r=>state.sel && state.sel.has(r.id));
    hr.append(h('th',{style:'width:34px'}, h('input',{type:'checkbox', ...(all?{checked:''}:{}), style:'width:15px;height:15px;padding:0',
      onchange:e=>{ state.sel = state.sel||new Set(); slice.forEach(r=> e.target.checked ? state.sel.add(r.id) : state.sel.delete(r.id)); onSelect && onSelect(); }})));
  }
  cols.forEach(c=>{
    const active = state.sort.key===c.key;
    hr.append(h('th',{class:'sortable'+(c.num?' num':''), onclick:()=>{
      state.sort = { key:c.key, dir: active && dir==='desc' ? 'asc' : 'desc' };
      onRow && onRow.rerender ? onRow.rerender() : null;
      if (state.rerender) state.rerender();
    }}, c.label, h('span',{class:'ar'}, active ? (dir==='desc'?'▼':'▲') : '⇅')));
  });
  tb.append(h('thead',{},hr));
  const body = h('tbody');
  slice.forEach(r=>{
    const tr = h('tr', onRow && onRow.click ? {class:'click', onclick:e=>{ if(e.target.type!=='checkbox') onRow.click(r); }} : {});
    if (selectable){
      tr.append(h('td',{}, h('input',{type:'checkbox', ...(state.sel && state.sel.has(r.id)?{checked:''}:{}), style:'width:15px;height:15px;padding:0',
        onchange:e=>{ state.sel = state.sel||new Set(); e.target.checked ? state.sel.add(r.id) : state.sel.delete(r.id); onSelect && onSelect(); }})));
    }
    cols.forEach(c=>{
      const v = c.cell ? c.cell(r) : c.get(r);
      body.append; tr.append(h('td',{class:c.num?'num':''}, v));
    });
    body.append(tr);
  });
  tb.append(body); tw.append(tb); wrap.append(tw);

  if (rows.length > pageSize){
    const pg = h('div',{class:'pager'});
    pg.append(h('span',{}, `${(state.page-1)*pageSize+1}–${Math.min(state.page*pageSize, rows.length)} of ${fmtN(rows.length)}`));
    const go = n => { state.page = n; state.rerender && state.rerender(); };
    pg.append(h('button',{class:'btn sm', ...(state.page===1?{disabled:''}:{}), onclick:()=>go(state.page-1)},'‹ Prev'),
              h('span',{}, `Page ${state.page} / ${pages}`),
              h('button',{class:'btn sm', ...(state.page===pages?{disabled:''}:{}), onclick:()=>go(state.page+1)},'Next ›'));
    wrap.append(pg);
  }
  return wrap;
}

/* undo-able delete: keeps a snapshot for 8 seconds */
function toastUndo(msg, undoFn){
  const t = h('div',{class:'toast warn'});
  t.append(h('span',{}, msg+'  '));
  t.append(h('button',{class:'btn sm', style:'margin-left:8px', onclick:()=>{ undoFn(); t.remove(); toast('Restored','good'); }},'Undo'));
  $('#toasts').append(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),320); }, 8000);
}

/* ================= voice dictation (Web Speech API) ================= */
const SPEECH_OK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
function dictateButton(onText, {lang = 'en-IN'} = {}) {
  if (!SPEECH_OK) return h('span', {});
  const b = h('button', {class: 'mic', type: 'button', title: 'Dictate (speech to text)'}, '🎤');
  let rec = null;
  b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (rec) { rec.stop(); return; }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    rec = new R();
    rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = ev => {
      const txt = Array.from(ev.results).map(r => r[0].transcript).join(' ').trim();
      if (txt) onText(txt);
    };
    rec.onerror = ev => { toast('Dictation: ' + (ev.error === 'not-allowed' ? 'microphone permission denied' : ev.error), 'warn'); };
    rec.onend = () => { b.classList.remove('rec'); rec = null; };
    try { rec.start(); b.classList.add('rec'); toast('Listening… speak now', 'good'); }
    catch (err) { rec = null; toast('Could not start dictation', 'bad'); }
  });
  return b;
}

/* ================= modal ================= */
const modal = {
  open({title, body, foot}){
    $('#modal-title').textContent = title;
    const b = $('#modal-body'); b.textContent=''; b.append(body);
    const f = $('#modal-foot'); f.textContent=''; if (foot) f.append(...foot);
    $('#overlay').classList.add('show');
  },
  close(){ $('#overlay').classList.remove('show'); }
};

/* ================= filters ================= */
function periodRange(p){
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  switch(p){
    case 'tm': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(d0) };
    case 'lm': { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: iso(f), to: iso(t) }; }
    case 'l30': { const f = new Date(d0); f.setDate(f.getDate()-29); return { from: iso(f), to: iso(d0) }; }
    case 'l90': { const f = new Date(d0); f.setDate(f.getDate()-89); return { from: iso(f), to: iso(d0) }; }
    case 'fy': { const fyStart = now.getMonth()>=3 ? new Date(now.getFullYear(),3,1) : new Date(now.getFullYear()-1,3,1); return { from: iso(fyStart), to: iso(d0) }; }
    default: return { from:'', to:'' };
  }
}
function filterObs({period='all', dept='', plant='', observer='', from='', to='', q=''}){
  let r = period && period!=='all' ? periodRange(period) : {from, to};
  if (from||to) r = {from, to};
  return S.obs.filter(o=>{
    if (r.from && o.date < r.from) return false;
    if (r.to && o.date > r.to) return false;
    if (dept && o.dept!==dept) return false;
    if (plant && o.plant!==plant) return false;
    if (observer && o.observer!==observer) return false;
    if (q){
      const s = (o.id+' '+o.observer+' '+o.dept+' '+o.plant+' '+o.location+' '+o.job).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  }).sort((a,b)=> (b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
}
const PERIODS = [['tm','This month'],['lm','Last month'],['l30','Last 30 days'],['l90','Last 90 days'],['fy','This FY (Apr–Mar)'],['all','All time']];
function selEl(opts, val, onch, allLabel){
  const s = h('select',{onchange:e=>onch(e.target.value)});
  if (allLabel!=null) s.append(h('option',{value:''}, allLabel));
  opts.forEach(o=>{
    const [v,l] = Array.isArray(o)?o:[o,o];
    s.append(h('option',{value:v, ...(v===val?{selected:''}:{})}, l));
  });
  if (allLabel!=null) s.value = val||'';
  return s;
}
function fWrap(labelTxt, ctrl){ return h('div',{class:'f'}, h('label',{},labelTxt), ctrl); }

/* ================= router ================= */
const VIEWS = {
  dashboard:{ t:'Dashboard', s:'Behaviour Based Safety · leading indicators', r:()=>renderDashboard() },
  new:{ t:'New BBS Observation', s:'Record safe & at-risk behaviours as per IGL BBSO format', r:()=>renderNew() },
  register:{ t:'Observation Register', s:'All BBS observation records', r:()=>renderRegister() },
  actions:{ t:'Corrective Actions', s:'CAPA arising from BBS observations', r:()=>renderActions() },
  analyser:{ t:'BBS Analyser', s:'Category, trend, department & observer analysis', r:()=>renderAnalyser() },
  ai:{ t:'AI Assistant', s:'OpenRouter-powered insights, reports & safety chat', r:()=>renderAI() },
  settings:{ t:'Settings', s:'Master data, checklist, targets & backup', r:()=>renderSettings() }
};
function showView(name){
  S.view = name;
  $$('.view').forEach(v=>v.classList.remove('on'));
  $('#view-'+name).classList.add('on');
  $$('#nav button').forEach(b=>b.classList.toggle('on', b.dataset.view===name));
  $('#view-title').textContent = VIEWS[name].t;
  $('#view-sub').textContent = VIEWS[name].s;
  $('#sidebar').classList.remove('open');
  VIEWS[name].r();
  updateCounts();
  window.scrollTo({top:0});
}
function updateCounts(){
  $('#cnt-obs').textContent = S.obs.length;
  const open = S.actions.filter(a=>a.status!=='Closed').length;
  $('#cnt-act').textContent = open;
}
