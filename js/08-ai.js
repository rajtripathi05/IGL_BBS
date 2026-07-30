/* ============================================================
   IGL BBS · 08-ai.js
   OpenRouter plumbing — chat, streaming, vision, usage log,
   model catalogue and the AI Assistant view
   ============================================================ */

const OR_BASE = 'https://openrouter.ai/api/v1';
const OR_FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'qwen/qwen3-32b:free',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'google/gemini-2.5-flash'
];
/* models that can read images — used by the photo hazard scan */
const OR_VISION_HINTS = /gpt-4o|gpt-4\.1|gpt-5|claude|gemini|llama-3\.2-(11|90)b-vision|qwen.*v[lm]|pixtral|internvl|molmo/i;

let OR_MODELS = null;           /* cached catalogue */

function orHeaders() {
  return {
    'Authorization': 'Bearer ' + S.set.openrouter.key,
    'Content-Type': 'application/json',
    'HTTP-Referer': location.origin || 'https://igl-bbs.netlify.app',
    'X-Title': 'IGL BBS'
  };
}
function orError(status, msg) {
  if (status === 401) return 'Invalid API key (401). Check it in AI Assistant → Setup.';
  if (status === 402) return 'Out of OpenRouter credits (402). Add credits or pick a ":free" model.';
  if (status === 403) return 'Model not available on this key (403). Try another model.';
  if (status === 429) return 'Rate limited (429). Wait a moment or switch model.';
  if (status >= 500) return 'OpenRouter server error (' + status + '). Try again shortly.';
  return msg || ('HTTP ' + status);
}
function logAi(kind, model, usage, ms) {
  S.ailog.push({
    t: new Date().toISOString(), kind, model,
    inTok: (usage && usage.prompt_tokens) || 0, outTok: (usage && usage.completion_tokens) || 0,
    cost: usage && usage.cost ? +usage.cost : 0, ms
  });
  if (S.ailog.length > 200) S.ailog = S.ailog.slice(-200);
  saveAiLog();
}

/**
 * Call OpenRouter. Pass opts.onDelta to stream tokens as they arrive.
 * Retries once on the configured fallback model for recoverable errors.
 */
async function orChat(messages, opts = {}) {
  const {json = false, temperature = 0.3, maxTokens = 1800, onDelta = null, kind = 'chat', model: modelOverride} = opts;
  if (!S.set.openrouter.key) throw new Error('No API key set');
  const stream = !!onDelta && S.set.openrouter.stream !== false && !json;

  const tryModel = async (model) => {
    const t0 = Date.now();
    const res = await fetch(OR_BASE + '/chat/completions', {
      method: 'POST', headers: orHeaders(),
      body: JSON.stringify({
        model, messages, temperature, max_tokens: maxTokens, stream,
        ...(stream ? {stream_options: {include_usage: true}} : {}),
        ...(json ? {response_format: {type: 'json_object'}} : {})
      })
    });
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = e.error && e.error.message; } catch (_) {}
      const err = new Error(orError(res.status, msg)); err.status = res.status; throw err;
    }
    if (!stream) {
      const data = await res.json();
      const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      logAi(kind, model, data.usage, Date.now() - t0);
      if (!txt) throw new Error('Empty response from model');
      return txt;
    }
    /* --- SSE streaming --- */
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '', usage = null;
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      buf += dec.decode(value, {stream: true});
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          if (j.usage) usage = j.usage;
          const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (d) { full += d; onDelta(full, d); }
        } catch (_) { /* keep-alive comment or partial chunk */ }
      }
    }
    logAi(kind, model, usage, Date.now() - t0);
    if (!full) throw new Error('Empty response from model');
    return full;
  };

  const primary = modelOverride || S.set.openrouter.model;
  try {
    return await tryModel(primary);
  } catch (err) {
    const fb = S.set.openrouter.fallback;
    if (fb && fb !== primary && err.status && [402, 403, 429, 500, 502, 503].includes(err.status)) {
      toast('Primary model unavailable — retrying on ' + fb, 'warn');
      return await tryModel(fb);
    }
    throw err;
  }
}

/** Vision call — pass one or more data-URL images with a prompt. */
async function orVision(prompt, images, opts = {}) {
  const model = S.set.openrouter.visionModel || 'google/gemini-2.5-flash';
  const content = [{type: 'text', text: prompt}];
  images.forEach(src => content.push({type: 'image_url', image_url: {url: src}}));
  return orChat([{role: 'user', content}], Object.assign({}, opts, {model, kind: opts.kind || 'vision'}));
}

async function orModels(force) {
  if (OR_MODELS && !force) return OR_MODELS;
  const res = await fetch(OR_BASE + '/models');
  if (!res.ok) throw new Error('Could not load model list (HTTP ' + res.status + ')');
  const data = await res.json();
  OR_MODELS = (data.data || []).map(m => ({
    id: m.id, name: m.name || m.id,
    ctx: m.context_length || 0,
    prompt: m.pricing ? +m.pricing.prompt : 0,
    free: /:free$/.test(m.id) || (m.pricing && +m.pricing.prompt === 0),
    vision: ((m.architecture && m.architecture.input_modalities) || []).includes('image') || OR_VISION_HINTS.test(m.id)
  })).sort((a, b) => a.id.localeCompare(b.id));
  return OR_MODELS;
}
async function orCredits() {
  const res = await fetch(OR_BASE + '/credits', {headers: orHeaders()});
  if (!res.ok) throw new Error(orError(res.status));
  const d = await res.json();
  return d.data || d;
}

function parseJsonLoose(txt) {
  let s = String(txt).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

/* ---------------- prompt context ---------------- */
function statsPayload(list) {
  const tot = list.reduce((a, o) => { const t = obsTotals(o); a.s += t.s; a.r += t.r; return a; }, {s: 0, r: 0});
  const cats = aggCat(list).filter(c => c.s + c.r > 0).map(c => ({cat: c.label, safe: c.s, atRisk: c.r}));
  const months = aggMonthly(list).map(m => ({month: m.label, obs: m.n, pctSafe: m.pct == null ? null : Math.round(m.pct * 10) / 10}));
  const depts = aggBy(list, 'dept').map(d => ({dept: d.label, obs: d.n, pctSafe: d.pct == null ? null : Math.round(d.pct * 10) / 10}));
  const topItems = aggItems(list).slice(0, 10).map(x => ({ref: x.ref, item: itemText(x.ref), count: x.count}));
  const remarks = [];
  list.slice(0, 40).forEach(o => { for (const ref in o.items) { const v = o.items[ref]; if (v.r > 0 && v.remark) remarks.push('[' + o.date + ' ' + (o.plant || '') + '] ' + v.remark.slice(0, 160)); } });
  const openActs = S.actions.filter(a => a.status !== 'Closed');
  const seenD = new Set(list.map(o => o.dept));
  return {
    company: 'India Glycols Limited, Kashipur (chemical manufacturing — glycols, glycol ethers, surfactants, distillery, power)',
    totals: {
      observations: list.length, safe: tot.s, atRisk: tot.r,
      pctSafe: (tot.s + tot.r) ? Math.round(tot.s / (tot.s + tot.r) * 1000) / 10 : null,
      targetPctSafe: S.set.targetSafe || 95,
      openActions: openActs.length,
      overdueActions: openActs.filter(a => a.due && a.due < todayStr()).length
    },
    byCategory: cats, byMonth: months, byDepartment: depts,
    topAtRiskItems: topItems, recentAtRiskRemarks: remarks.slice(0, 25),
    departmentsWithNoObservations: S.set.departments.filter(d => !seenD.has(d))
  };
}

const SYS_BBS = 'You are the AI safety assistant inside the IGL BBS (Behaviour Based Safety) application of India Glycols Limited, a chemical manufacturing company at Kashipur, Uttarakhand. You are an expert in behaviour based safety, process safety and Indian industrial safety practice (Factories Act 1948, PPE norms, work permits, LOTO, HIRA/JSA, hierarchy of controls). Be practical, specific and concise. Use markdown. Never invent data that is not in the provided JSON.';

/* ---------------- core AI actions ---------------- */
async function aiInsights(list, onDelta) {
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Analyse this BBS observation data and give: 1) Three key patterns/trends, 2) Top risks needing management attention, 3) Three specific recommended focus areas for next month (name the department/category), 4) Participation gaps, 5) One positive reinforcement highlight. Under 280 words, short bullets.\n\nDATA:\n' + JSON.stringify(statsPayload(list))}
  ], {onDelta, kind: 'insights'});
}
async function aiSuggestActions(o, onDelta) {
  const risky = Object.entries(o.items || {}).filter(([, v]) => v.r > 0)
    .map(([ref, v]) => ({ref, item: itemText(ref), category: itemCat(ref), remark: v.remark || '', correctedOnSpot: !!v.corrected, highRisk: !!v.high}));
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'For this BBS observation at ' + (o.plant || 'plant') + ' (' + (o.location || '') + ', job: ' + (o.job || '') + '), suggest corrective & preventive actions for each at-risk item: immediate action, systemic/root-cause action, and suggested owner (role) + timeline. Follow the hierarchy of controls. Max 60 words per item.\n\nAT-RISK ITEMS:\n' + JSON.stringify(risky)}
  ], {onDelta, kind: 'capa'});
}
async function aiFillChecklist(text) {
  const flat = [];
  S.set.checklist.forEach(c => c.items.forEach(it => { if (!it.off) flat.push({ref: it.ref, category: c.name, item: it.text}); }));
  const out = await orChat([
    {role: 'system', content: 'You convert free-text BBS (behaviour based safety) observation notes into checklist markings. Reply with ONLY valid JSON, no prose.'},
    {role: 'user', content: 'CHECKLIST:\n' + JSON.stringify(flat) + '\n\nOBSERVATION NOTES:\n"""' + text + '"""\n\nReturn JSON mapping ONLY the checklist refs clearly evidenced in the notes: {"<ref>":{"safe":<count>,"risk":<count>,"remark":"<short remark, only for at-risk or notable items>"}}. Small integer counts (usually 1). Omit refs with no evidence. JSON only.'}
  ], {json: true, temperature: 0.1, kind: 'autofill'});
  return parseJsonLoose(out);
}
async function aiMonthlyReport(monthKey, onDelta) {
  const list = S.obs.filter(o => mKey(o.date) === monthKey);
  const payload = statsPayload(list);
  payload.actionsCreatedThisMonth = S.actions.filter(a => (a.createdAt || '').slice(0, 7) === monthKey).length;
  payload.actionsClosedThisMonth = S.actions.filter(a => (a.closedOn || '').slice(0, 7) === monthKey).length;
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Draft a formal monthly BBS report for ' + mLabel(monthKey) + ' for India Glycols Limited, to circulate to HODs and plant leadership. Structure: # heading, 1. Executive summary, 2. Observation statistics, 3. Category analysis, 4. Department participation, 5. Key at-risk behaviours & corrective actions, 6. Recommendations & next month focus. Markdown with short tables/bullets. Base every number ONLY on this data:\n\n' + JSON.stringify(payload)}
  ], {maxTokens: 2400, onDelta, kind: 'report'});
}

/* ---------------- markdown-lite renderer (safe: builds DOM) ---------------- */
function mdToHtml(md) {
  const root = h('div', {class: 'md'});
  const lines = String(md).split(/\r?\n/);
  let list = null, table = null;
  const inline = (el, s) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    parts.forEach(p => {
      if (/^\*\*[^*]+\*\*$/.test(p)) el.append(h('strong', {}, p.slice(2, -2)));
      else if (/^`[^`]+`$/.test(p)) el.append(h('code', {}, p.slice(1, -1)));
      else if (p) el.append(p.replace(/\*([^*]+)\*/g, '$1'));
    });
  };
  const flush = () => { list = null; table = null; };
  lines.forEach(raw => {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); return; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { flush(); const el = h('h' + m[1].length, {}); inline(el, m[2]); root.append(el); return; }
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { table = h('table', {}); table.__head = false; root.append(h('div', {class: 'tbl-wrap', style: 'margin:8px 0'}, table)); }
      const tr = h('tr', {});
      cells.forEach(c => { const el = h(table.__head ? 'td' : 'th', {}); inline(el, c); tr.append(el); });
      table.__head = true; table.append(tr); return;
    }
    if ((m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/))) {
      if (!list) { list = h('ul', {}); root.append(list); }
      const li = h('li', {}); inline(li, m[1]); list.append(li); return;
    }
    flush();
    const p = h('p', {}); inline(p, line); root.append(p);
  });
  return root;
}

/* Streaming target: re-renders markdown as tokens land. */
function streamInto(mount) {
  mount.textContent = '';
  const box = h('div', {class: 'md stream-cursor'});
  mount.append(box);
  return {
    update(full) { const r = mdToHtml(full); box.textContent = ''; while (r.firstChild) box.append(r.firstChild); },
    done(full) { box.classList.remove('stream-cursor'); if (full != null) this.update(full); }
  };
}

/** Run an AI action into a mount with a busy button; streams when the model supports it. */
async function runAi(btn, mount, fn, label) {
  if (!S.set.openrouter.key) {
    modal.close();                       /* never leave a dialog blocking the page */
    toast('Add your OpenRouter API key first — AI Assistant → Setup', 'warn');
    S.aiTab = 'setup'; showView('ai');
    return null;
  }
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = ''; btn.append(h('span', {class: 'spin'}), ' ' + (label || 'Working…'));
  const st = streamInto(mount);
  try {
    const out = await fn(full => st.update(full));
    st.done(out);
    return out;
  } catch (err) {
    mount.textContent = ''; mount.append(h('div', {class: 'chip crit'}, '⚠ ' + err.message));
    toast('AI error: ' + err.message, 'bad');
    return null;
  } finally {
    btn.disabled = false; btn.textContent = old;
  }
}

/* ================= AI Assistant view ================= */
function renderAI() {
  const V = $('#view-ai'); V.textContent = '';
  S.aiTab = S.aiTab || 'tools';
  const tabs = h('div', {class: 'tabs'});
  [['tools', '✦ AI tools'], ['chat', '💬 Safety chat'], ['reports', '📄 Reports'], ['setup', '⚙ Setup & models'], ['usage', '📊 Usage']]
    .forEach(([k, l]) => tabs.append(h('button', {class: S.aiTab === k ? 'on' : '', onclick: () => { S.aiTab = k; renderAI(); }}, l)));
  V.append(tabs);

  if (!S.set.openrouter.key && S.aiTab !== 'setup') {
    V.append(h('div', {class: 'demo-bar'},
      h('span', {}, '🔑 '), h('b', {}, 'No API key yet'),
      h('span', {}, '— AI features need an OpenRouter key. Free models are available.'),
      h('span', {class: 'grow'}),
      h('button', {class: 'btn sm primary', onclick: () => { S.aiTab = 'setup'; renderAI(); }}, 'Set it up →')));
  }

  if (S.aiTab === 'setup') aiTabSetup(V);
  if (S.aiTab === 'tools') aiTabTools(V);
  if (S.aiTab === 'chat') aiTabChat(V);
  if (S.aiTab === 'reports') aiTabReports(V);
  if (S.aiTab === 'usage') aiTabUsage(V);
}

function aiTabSetup(V) {
  const or = S.set.openrouter;
  const setup = h('div', {class: 'card'}, h('h3', {}, 'OpenRouter connection'),
    h('div', {class: 'hint'}, 'One key unlocks hundreds of models — many free. Get one at ',
      h('a', {href: 'https://openrouter.ai/keys', target: '_blank', rel: 'noopener'}, 'openrouter.ai/keys')));
  const keyIn = h('input', {type: 'password', placeholder: 'sk-or-v1-…', value: or.key || '', oninput: e => { S.set.openrouter.key = e.target.value.trim(); saveSet(); }});
  const showB = h('button', {class: 'btn sm ghost', onclick: () => { keyIn.type = keyIn.type === 'password' ? 'text' : 'password'; showB.textContent = keyIn.type === 'password' ? '👁 Show' : 'Hide'; }}, '👁 Show');
  const out = h('span', {class: 'note', style: 'margin-left:8px'});
  const testB = h('button', {class: 'btn sm primary', onclick: async () => {
    if (!S.set.openrouter.key) { toast('Enter your API key first', 'warn'); return; }
    testB.disabled = true; out.textContent = 'Testing…'; out.style.color = '';
    try {
      await orChat([{role: 'user', content: 'Reply with exactly: OK'}], {maxTokens: 10, kind: 'test'});
      let extra = '';
      try { const c = await orCredits(); if (c && c.total_credits != null) extra = ' · $' + (+c.total_usage || 0).toFixed(3) + ' used of $' + (+c.total_credits).toFixed(2); } catch (_) {}
      out.textContent = '✓ Connected' + extra; out.style.color = 'var(--good)';
      toast('OpenRouter connected', 'good');
    } catch (err) { out.textContent = '✗ ' + err.message; out.style.color = 'var(--crit)'; }
    testB.disabled = false;
  }}, 'Test connection');

  const modelBox = h('div', {});
  const drawModels = () => {
    modelBox.textContent = '';
    const mk = (label, key, filter, allowNone) => {
      const sel = h('select', {onchange: e => { S.set.openrouter[key] = e.target.value; saveSet(); }});
      const opts = OR_MODELS ? OR_MODELS.filter(filter || (() => true))
        : OR_FALLBACK_MODELS.map(id => ({id, free: /:free$/.test(id), ctx: 0, prompt: 0}));
      const cur = S.set.openrouter[key] || '';
      if (allowNone) sel.append(h('option', {value: ''}, '— none —'));
      let has = false;
      opts.forEach(m => {
        if (m.id === cur) has = true;
        const price = m.free ? 'free' : (m.prompt ? '$' + (m.prompt * 1e6).toFixed(2) + '/M tok' : '');
        sel.append(h('option', {value: m.id}, m.id + (price ? '  ·  ' + price : '') + (m.ctx ? '  ·  ' + Math.round(m.ctx / 1000) + 'k ctx' : '')));
      });
      if (cur && !has) sel.append(h('option', {value: cur}, cur));
      sel.value = cur;
      return h('div', {}, h('label', {}, label), sel);
    };
    modelBox.append(h('div', {class: 'grid g3'},
      mk('Primary model', 'model'),
      mk('Fallback (used when the primary is rate-limited)', 'fallback', null, true),
      mk('Vision model (photo hazard scan)', 'visionModel', m => m.vision)));
  };
  drawModels();

  const loadB = h('button', {class: 'btn sm', onclick: async () => {
    loadB.disabled = true; loadB.textContent = 'Loading…';
    try { const m = await orModels(true); drawModels(); toast('Loaded ' + m.length + ' models (' + m.filter(x => x.free).length + ' free)', 'good'); }
    catch (err) { toast(err.message, 'bad'); }
    loadB.disabled = false; loadB.textContent = '↻ Load live model list';
  }}, '↻ Load live model list');

  const strTgl = h('label', {class: 'tgl' + (or.stream !== false ? ' on ok' : '')},
    h('input', {type: 'checkbox', ...(or.stream !== false ? {checked: ''} : {}), onchange: e => { S.set.openrouter.stream = e.target.checked; saveSet(); strTgl.classList.toggle('on', e.target.checked); strTgl.classList.toggle('ok', e.target.checked); }}),
    'Stream responses live');

  setup.append(h('div', {class: 'grid g2', style: 'margin-top:6px'},
    h('div', {}, h('label', {}, 'API key (stored only in this browser)'), h('div', {style: 'display:flex;gap:7px'}, keyIn, showB)),
    h('div', {}, h('label', {}, 'Connection'), h('div', {style: 'display:flex;gap:7px;align-items:center;flex-wrap:wrap'}, testB, out))),
    h('div', {class: 'divider'}), modelBox,
    h('div', {style: 'margin-top:10px;display:flex;gap:9px;align-items:center;flex-wrap:wrap'}, loadB, strTgl));
  V.append(setup);

  V.append(h('div', {class: 'card', style: 'margin-top:14px'}, h('h3', {}, 'How your data is used'),
    h('div', {class: 'hint'}, 'The key and every observation stay in this browser. When you run an AI action, only aggregated statistics — or the one observation you picked — are sent directly from your browser to openrouter.ai. Nothing passes through a Netlify server and nothing is stored by this app.')));

  const pl = h('div', {class: 'card', style: 'margin-top:14px'}, h('h3', {}, 'Saved prompts'),
    h('div', {class: 'hint'}, 'Your own reusable prompts — they appear as one-click buttons in Safety chat'));
  (S.set.prompts || []).forEach((p, i) => pl.append(h('div', {style: 'display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)'},
    h('span', {class: 'strong', style: 'flex:0 0 150px'}, p.name),
    h('span', {class: 'note', style: 'flex:1'}, p.text.length > 90 ? p.text.slice(0, 89) + '…' : p.text),
    h('button', {class: 'btn sm danger', onclick: () => { S.set.prompts.splice(i, 1); saveSet(); renderAI(); }}, 'Delete'))));
  const pn = h('input', {type: 'text', placeholder: 'Button label, e.g. "Weekly HOD note"'});
  const pt = h('textarea', {placeholder: 'Prompt text…'});
  pl.append(h('div', {class: 'grid g2', style: 'margin-top:10px'}, h('div', {}, h('label', {}, 'Label'), pn), h('div', {}, h('label', {}, 'Prompt'), pt)),
    h('button', {class: 'btn sm', style: 'margin-top:8px', onclick: () => {
      if (!pn.value.trim() || !pt.value.trim()) { toast('Give the prompt a label and text', 'warn'); return; }
      S.set.prompts = S.set.prompts || []; S.set.prompts.push({name: pn.value.trim(), text: pt.value.trim()});
      saveSet(); renderAI(); toast('Prompt saved', 'good');
    }}, '+ Save prompt'));
  V.append(pl);
}

function aiTabChat(V) {
  const chatC = h('div', {class: 'card'}, h('h3', {}, 'Safety assistant chat'),
    h('div', {class: 'hint'}, 'Knows your last 90 days of BBS data. Ask about trends, standards, PPE, PTW, LOTO, toolbox topics…'));
  const log = h('div', {class: 'log'});
  const chat = h('div', {class: 'chat'}, log);
  const addMsg = (role, content) => {
    const m = h('div', {class: 'msg ' + (role === 'user' ? 'u' : 'a')});
    if (role === 'user') m.textContent = content; else m.append(mdToHtml(content));
    log.append(m); log.scrollTop = log.scrollHeight;
    return m;
  };
  S.chat.forEach(m => addMsg(m.role === 'user' ? 'user' : 'a', m.content));
  if (!S.chat.length) addMsg('a', 'Namaste! I am your BBS safety assistant. Ask me about your observation data, or any safety topic — PPE, work permits, LOTO, work at height, chemical handling…');
  const q = h('input', {type: 'text', placeholder: 'Ask a safety question…', onkeydown: e => { if (e.key === 'Enter') send(); }});
  const sendB = h('button', {class: 'btn primary sm', onclick: () => send()}, 'Send');

  async function send(preset) {
    const text = (preset || q.value).trim(); if (!text) return;
    if (!S.set.openrouter.key) { toast('Add your OpenRouter API key first', 'warn'); S.aiTab = 'setup'; renderAI(); return; }
    q.value = '';
    addMsg('user', text);
    S.chat.push({role: 'user', content: text});
    const bubble = addMsg('a', '');
    const st = streamInto(bubble);
    try {
      const ctx = statsPayload(filterObs({period: 'l90'}));
      const msgs = [{role: 'system', content: SYS_BBS + '\n\nCurrent BBS data snapshot (last 90 days):\n' + JSON.stringify(ctx)},
        ...S.chat.slice(-10).map(m => ({role: m.role, content: m.content}))];
      const outTxt = await orChat(msgs, {maxTokens: 1100, onDelta: full => { st.update(full); log.scrollTop = log.scrollHeight; }, kind: 'chat'});
      st.done(outTxt);
      S.chat.push({role: 'assistant', content: outTxt});
      if (S.chat.length > 30) S.chat = S.chat.slice(-30);
      saveChat();
    } catch (err) { bubble.textContent = '⚠ ' + err.message; }
    log.scrollTop = log.scrollHeight;
  }
  const quick = h('div', {class: 'quick'});
  ['Which department needs most attention?', 'Draft a toolbox talk on line of fire', 'Top 3 focus areas for next month', 'Explain our % safe trend to a plant head']
    .forEach(t => quick.append(h('button', {onclick: () => send(t)}, t)));
  (S.set.prompts || []).forEach(p => quick.append(h('button', {style: 'border-color:var(--acc);color:var(--acc)', onclick: () => send(p.text)}, '★ ' + p.name)));
  chat.append(quick, h('div', {class: 'inp'}, q, sendB));
  chatC.append(chat, h('button', {class: 'btn sm ghost', style: 'margin-top:8px', onclick: () => { S.chat = []; saveChat(); renderAI(); }}, 'Clear chat'));
  V.append(chatC);
}

function aiTabUsage(V) {
  const log = S.ailog || [];
  const tok = log.reduce((a, x) => a + (x.inTok || 0) + (x.outTok || 0), 0);
  const cost = log.reduce((a, x) => a + (x.cost || 0), 0);
  const kp = h('div', {class: 'kpis'});
  [['AI calls', fmtN(log.length)], ['Tokens used', fmtN(tok)], ['Reported cost', '$' + cost.toFixed(4)],
   ['Avg response', log.length ? (Math.round(log.reduce((a, x) => a + (x.ms || 0), 0) / log.length / 100) / 10) + 's' : '–']]
    .forEach(([l, v]) => kp.append(h('div', {class: 'kpi'}, h('div', {class: 'l'}, l), h('div', {class: 'v'}, v))));
  V.append(kp);

  const byKind = {};
  log.forEach(x => { byKind[x.kind] = (byKind[x.kind] || 0) + 1; });
  if (Object.keys(byKind).length) {
    const c = h('div', {class: 'card chart-card'}, h('h3', {}, 'AI usage by feature'), h('div', {class: 'hint'}, 'Calls made from this browser'));
    const m = h('div', {class: 'ch'}); c.append(m);
    hbarChart(m, {data: Object.entries(byKind).map(([k, v]) => ({label: k, value: v})).sort((a, b) => b.value - a.value)});
    V.append(c);
  }

  const c2 = h('div', {class: 'card', style: 'margin-top:14px'}, h('h3', {}, 'Recent AI calls'), h('div', {class: 'hint'}, 'Last 30 — stored locally, never uploaded'));
  if (!log.length) c2.append(h('div', {class: 'empty'}, 'No AI calls yet'));
  else {
    const t = h('table', {});
    t.append(h('thead', {}, h('tr', {}, [h('th', {}, 'When'), h('th', {}, 'Feature'), h('th', {}, 'Model'), h('th', {class: 'num'}, 'In'), h('th', {class: 'num'}, 'Out'), h('th', {class: 'num'}, 'Time')])));
    const tb = h('tbody', {});
    log.slice(-30).reverse().forEach(x => tb.append(h('tr', {}, [
      h('td', {}, new Date(x.t).toLocaleString('en-IN')), h('td', {}, x.kind), h('td', {}, String(x.model || '').split('/').pop()),
      h('td', {class: 'num'}, fmtN(x.inTok)), h('td', {class: 'num'}, fmtN(x.outTok)), h('td', {class: 'num'}, x.ms ? (x.ms / 1000).toFixed(1) + 's' : '–')])));
    t.append(tb); c2.append(h('div', {class: 'tbl-wrap'}, t));
    c2.append(h('button', {class: 'btn sm ghost', style: 'margin-top:9px', onclick: () => { S.ailog = []; saveAiLog(); renderAI(); }}, 'Clear log'));
  }
  V.append(c2);
}
