/* ============================================================
   IGL BBS · 10-ai-tools.js
   AI toolbox — toolbox talks, root-cause, translation, quizzes,
   photo hazard scan, digests, CAPA review and the Reports tab
   ============================================================ */

/* ---------------- individual AI tools ---------------- */

/** 5-minute toolbox talk on the plant's current top at-risk theme. */
async function aiToolboxTalk(topic, onDelta) {
  const list = filterObs({period: 'l90'});
  const top = aggItems(list).slice(0, 6).map(x => itemText(x.ref));
  const theme = topic || top[0] || 'general plant safety';
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Write a 5-minute toolbox talk (TBT) script for shop-floor workers at IGL Kashipur on: "' + theme + '".\n\nStructure: title, why it matters (with a realistic chemical-plant consequence), 4–6 do\'s and don\'ts, 2 questions to ask the team, and a one-line commitment. Simple English a supervisor can read aloud. Reference these recent at-risk findings where relevant: ' + JSON.stringify(top)}
  ], {onDelta, kind: 'toolbox', maxTokens: 1200});
}

/** 5-Why + contributing-factor analysis for one observation. */
async function aiRootCause(o, onDelta) {
  const risky = Object.entries(o.items || {}).filter(([, v]) => v.r > 0)
    .map(([ref, v]) => ({item: itemText(ref), category: itemCat(ref), remark: v.remark || '', highRisk: !!v.high}));
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Do a root-cause analysis of this BBS observation.\n\nContext: plant ' + (o.plant || '-') + ', location ' + (o.location || '-') + ', job "' + (o.job || '-') + '", shift ' + (o.shift || '-') + '.\nAt-risk findings: ' + JSON.stringify(risky) + '\n\nGive: 1) a 5-Why chain for the most significant finding, 2) contributing factors grouped as People / Process / Equipment / Environment / Management system, 3) the single most likely root cause, 4) two systemic barriers that would prevent recurrence. Be concise.'}
  ], {onDelta, kind: 'rootcause', maxTokens: 1200});
}

/** Translate any generated text (report, TBT) into Hindi or Hinglish. */
async function aiTranslate(text, lang, onDelta) {
  const target = lang === 'hinglish' ? 'Hinglish (Hindi written in Roman script, as spoken on an Indian shop floor)' : 'Hindi (Devanagari script)';
  return orChat([
    {role: 'system', content: 'You are a professional translator for industrial safety material in India. Keep technical safety terms (PPE, LOTO, permit, HIRA) recognisable. Preserve markdown structure exactly.'},
    {role: 'user', content: 'Translate the following safety text into ' + target + '. Output only the translation.\n\n' + text}
  ], {onDelta, kind: 'translate', maxTokens: 2400});
}

/** Ten-question safety quiz from the plant's own findings. */
async function aiQuiz(onDelta) {
  const list = filterObs({period: 'l90'});
  const top = aggItems(list).slice(0, 8).map(x => ({item: itemText(x.ref), category: itemCat(x.ref), count: x.count}));
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Create a 10-question multiple-choice safety quiz (4 options each) for IGL Kashipur operators, based on these real at-risk findings from the last 90 days: ' + JSON.stringify(top) + '. Cover the highest-frequency items. Give the answer key with a one-line explanation at the end. Markdown.'}
  ], {onDelta, kind: 'quiz', maxTokens: 1800});
}

/** Weekly leadership digest. */
async function aiDigest(days, onDelta) {
  const from = new Date(); from.setDate(from.getDate() - (days || 7));
  const list = filterObs({from: from.toISOString().slice(0, 10), to: todayStr()});
  const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - (days || 7));
  const prev = filterObs({from: prevFrom.toISOString().slice(0, 10), to: from.toISOString().slice(0, 10)});
  const pack = {thisPeriod: statsPayload(list), previousPeriod: statsPayload(prev).totals, days: days || 7};
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Write a short leadership digest for the last ' + (days || 7) + ' days — the kind a plant head reads in 60 seconds. Include: headline (one sentence), what moved vs the previous period (up/down with numbers), two things that need a decision, and one recognition. Max 200 words.\n\n' + JSON.stringify(pack)}
  ], {onDelta, kind: 'digest', maxTokens: 900});
}

/** Review open CAPAs and propose closure/verification steps and priorities. */
async function aiActionReview(onDelta) {
  const open = S.actions.filter(a => a.status !== 'Closed').slice(0, 40).map(a => ({
    id: a.id, desc: a.desc.slice(0, 160), dept: a.dept, priority: a.priority, status: a.status,
    due: a.due, overdue: !!(a.due && a.due < todayStr())
  }));
  if (!open.length) throw new Error('No open corrective actions to review');
  return orChat([
    {role: 'system', content: SYS_BBS},
    {role: 'user', content: 'Review these open BBS corrective actions. Give: 1) the five to close first and why, 2) any that look like duplicates or the same underlying issue (group them), 3) for the three most serious, a concrete verification step that proves closure, 4) one systemic fix that would remove a whole cluster of them. Concise, markdown.\n\n' + JSON.stringify(open)}
  ], {onDelta, kind: 'capa-review', maxTokens: 1400});
}

/** Photo hazard scan — vision model reads a site photo and maps findings to the checklist. */
async function aiPhotoScan(images, onDelta) {
  const flat = [];
  S.set.checklist.forEach(c => c.items.forEach(it => { if (!it.off) flat.push(it.ref + ' ' + it.text); }));
  return orVision(
    'You are a safety officer at a chemical plant (India Glycols, Kashipur) reviewing a photograph taken during a Behaviour Based Safety observation.\n\n' +
    'Describe what you can actually see, then list: (a) unsafe acts or conditions visible, (b) safe behaviours worth reinforcing, (c) which BBSO checklist items each finding maps to, (d) immediate corrective actions.\n' +
    'Only state what is genuinely visible — say so if the image is unclear. Markdown, concise.\n\n' +
    'BBSO CHECKLIST:\n' + flat.join('\n'),
    images, {onDelta, kind: 'photo-scan', maxTokens: 1200});
}

/** Severity scoring of at-risk items — used to auto-prioritise CAPA. */
async function aiScoreSeverity(o) {
  const risky = Object.entries(o.items || {}).filter(([, v]) => v.r > 0)
    .map(([ref, v]) => ({ref, item: itemText(ref), remark: v.remark || ''}));
  if (!risky.length) throw new Error('This observation has no at-risk items');
  const out = await orChat([
    {role: 'system', content: 'You score industrial safety findings. Reply with ONLY valid JSON.'},
    {role: 'user', content: 'For each at-risk finding, score potential severity if it went wrong (1 = minor first aid, 5 = fatality/major process safety event) and likelihood (1 = rare, 5 = frequent). Context: chemical plant, job "' + (o.job || '') + '" at ' + (o.plant || '') + '.\n\nFINDINGS:\n' + JSON.stringify(risky) + '\n\nReturn {"<ref>":{"severity":n,"likelihood":n,"priority":"High|Medium|Low","why":"<12 words>"}}. JSON only.'}
  ], {json: true, temperature: 0.1, kind: 'severity'});
  return parseJsonLoose(out);
}

/* ---------------- Tools tab ---------------- */
function aiToolCard(icon, title, desc, run) {
  return h('div', {class: 'ai-card', onclick: run},
    h('div', {class: 't'}, icon + '  ' + title), h('div', {class: 'd'}, desc));
}

function aiOutputModal(title, runner, {translate = true, month = null} = {}) {
  const body = h('div', {});
  const out = h('div', {style: 'min-height:120px;max-height:56vh;overflow-y:auto'});
  const bar = h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px'});
  let text = '';

  const goB = h('button', {class: 'btn sm primary', onclick: async () => {
    text = await runAi(goB, out, runner) || '';
    copyB.style.display = text ? '' : 'none';
    dlB.style.display = text ? '' : 'none';
    if (translate) { hiB.style.display = text ? '' : 'none'; hgB.style.display = text ? '' : 'none'; }
  }}, '✦ Generate');
  const copyB = h('button', {class: 'btn sm', style: 'display:none', onclick: async () => {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'good'); } catch (e) { toast('Copy failed', 'bad'); }
  }}, '⧉ Copy');
  const dlB = h('button', {class: 'btn sm', style: 'display:none', onclick: () => {
    dl('IGL_BBS_' + title.replace(/[^A-Za-z0-9]+/g, '_') + '_' + todayStr() + '.md', new Blob([text], {type: 'text/markdown'}));
  }}, '⬇ Download');
  const mkTrans = (label, lang) => h('button', {class: 'btn sm', style: 'display:none', onclick: async e => {
    const src = text;
    const t = await runAi(e.target, out, d => aiTranslate(src, lang, d), 'Translating…');
    if (t) text = t;
  }}, label);
  const hiB = mkTrans('अ हिंदी', 'hindi');
  const hgB = mkTrans('Hinglish', 'hinglish');

  bar.append(goB, copyB, dlB, hiB, hgB);
  body.append(bar, out);
  modal.open({title, body, foot: [h('button', {class: 'btn sm primary', onclick: () => modal.close()}, 'Close')]});
  goB.click();
}

function aiTabTools(V) {
  V.append(h('div', {class: 'card', style: 'margin-bottom:14px'},
    h('h3', {}, 'What the AI can do with your BBS data'),
    h('div', {class: 'hint'}, 'Everything below runs on the observations already in this browser. Nothing is uploaded anywhere except the OpenRouter model you chose.')));

  const g = h('div', {class: 'grid g3'});
  g.append(
    aiToolCard('📈', 'Data insights', 'Patterns, risks and next-month focus areas from the last 90 days',
      () => aiOutputModal('AI safety insights', d => aiInsights(filterObs({period: 'l90'}), d))),
    aiToolCard('🗣', 'Toolbox talk', 'A 5-minute TBT script on your current top at-risk behaviour',
      () => aiOutputModal('Toolbox talk', d => aiToolboxTalk(null, d))),
    aiToolCard('🔍', 'Root cause (5-Why)', 'Pick an observation and get a 5-Why plus contributing factors',
      () => pickObsThen(o => aiOutputModal('Root cause — ' + o.id, d => aiRootCause(o, d)))),
    aiToolCard('⚙', 'CAPA review', 'Which open actions to close first, duplicates, verification steps',
      () => aiOutputModal('Corrective action review', d => aiActionReview(d))),
    aiToolCard('📰', 'Weekly digest', 'A 60-second leadership brief comparing this week with last',
      () => aiOutputModal('Weekly digest', d => aiDigest(7, d))),
    aiToolCard('🎓', 'Safety quiz', '10 MCQs built from your own at-risk findings, with answer key',
      () => aiOutputModal('Safety quiz', d => aiQuiz(d))),
    aiToolCard('📷', 'Photo hazard scan', 'Upload a site photo — the AI lists hazards and maps them to the checklist',
      () => photoScanModal()),
    aiToolCard('⚖', 'Severity scoring', 'Score an observation\'s findings and re-prioritise its corrective actions',
      () => pickObsThen(o => severityModal(o), o => Object.values(o.items || {}).some(v => v.r > 0))),
    aiToolCard('✍', 'Checklist auto-fill', 'Describe what you saw in plain words — the AI marks the BBSO checklist',
      () => { F = null; showView('new'); setTimeout(() => { const t = document.querySelector('.ai-fill textarea'); if (t) t.focus(); }, 150); })
  );
  V.append(g);
}

/** Small observation picker used by the tools that need one record. */
function pickObsThen(fn, filter) {
  let list = S.obs.slice(0, 300);
  if (filter) list = list.filter(filter);
  if (!list.length) { toast('No matching observation found', 'warn'); return; }
  const body = h('div', {});
  const q = h('input', {type: 'search', placeholder: 'Filter by ID, observer, job…', oninput: () => draw()});
  body.append(h('label', {}, 'Choose an observation'), q);
  const mount = h('div', {style: 'max-height:46vh;overflow-y:auto;margin-top:10px'});
  body.append(mount);
  function draw() {
    const s = q.value.toLowerCase();
    mount.textContent = '';
    list.filter(o => !s || (o.id + ' ' + o.observer + ' ' + o.job + ' ' + o.plant).toLowerCase().includes(s)).slice(0, 40)
      .forEach(o => {
        const t = obsTotals(o);
        mount.append(h('div', {class: 'ac-row', onclick: () => { modal.close(); fn(o); }},
          h('div', {style: 'color:var(--ink);font-weight:600'}, o.id + ' · ' + (o.job || o.location || '')),
          h('div', {class: 'note'}, dLabel(o.date) + ' · ' + o.observer + ' · ' + o.plant + ' · ' + t.s + ' safe / ' + t.r + ' at risk')));
      });
  }
  draw();
  modal.open({title: 'Select an observation', body, foot: [h('button', {class: 'btn sm', onclick: () => modal.close()}, 'Cancel')]});
}

/* ---------------- photo hazard scan ---------------- */
function photoScanModal(preset) {
  const body = h('div', {});
  const imgs = (preset || []).slice();
  const row = h('div', {class: 'photo-row'});
  const out = h('div', {style: 'margin-top:12px;max-height:44vh;overflow-y:auto'});
  const draw = () => {
    row.textContent = '';
    imgs.forEach((src, i) => {
      const p = h('div', {class: 'photo', onclick: () => openPhoto(src)});
      p.append(h('img', {src, alt: 'Photo ' + (i + 1)}),
        h('button', {class: 'rm', title: 'Remove', onclick: e => { e.stopPropagation(); imgs.splice(i, 1); draw(); }}, '✕'));
      row.append(p);
    });
    if (imgs.length < 3) row.append(photoAddButton(src => { imgs.push(src); draw(); }));
  };
  draw();
  body.append(h('div', {class: 'hint'}, 'Add up to three photos from the site. A vision-capable model (Setup → Vision model) reads them and maps what it sees to the BBSO checklist.'), row, out);
  const goB = h('button', {class: 'btn sm primary', onclick: async () => {
    if (!imgs.length) { toast('Add at least one photo', 'warn'); return; }
    await runAi(goB, out, d => aiPhotoScan(imgs, d), 'Looking at the photo…');
  }}, '✦ Scan for hazards');
  modal.open({title: 'Photo hazard scan', body, foot: [goB, h('button', {class: 'btn sm', onclick: () => modal.close()}, 'Close')]});
}

/** File input that compresses a picked image to a small data URL. */
function photoAddButton(onPick, label) {
  const inp = h('input', {type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none', onchange: e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    compressImage(f).then(onPick).catch(err => toast('Could not read image: ' + err.message, 'bad'));
  }});
  const b = h('div', {class: 'photo-add', onclick: () => inp.click()}, h('span', {style: 'font-size:18px'}, '＋'), label || 'Photo');
  b.append(inp);
  return b;
}

/** Downscale to max 1280px and JPEG-encode so photos fit in localStorage. */
function compressImage(file, max = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read failed'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('not an image'));
      img.onload = () => {
        let {width: w, height: hh} = img;
        const scale = Math.min(1, max / Math.max(w, hh));
        w = Math.round(w * scale); hh = Math.round(hh * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = hh;
        c.getContext('2d').drawImage(img, 0, 0, w, hh);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------------- severity scoring ---------------- */
function severityModal(o) {
  const body = h('div', {});
  const out = h('div', {style: 'min-height:80px'});
  body.append(h('div', {class: 'hint'}, 'Scores each at-risk finding of ' + o.id + ' for severity and likelihood, then offers to re-prioritise its corrective actions.'), out);
  const goB = h('button', {class: 'btn sm primary', onclick: async () => {
    goB.disabled = true; const old = goB.textContent; goB.textContent = ''; goB.append(h('span', {class: 'spin'}), ' Scoring…');
    try {
      const res = await aiScoreSeverity(o);
      out.textContent = '';
      const t = h('table', {});
      t.append(h('thead', {}, h('tr', {}, [h('th', {}, 'Finding'), h('th', {class: 'num'}, 'Sev'), h('th', {class: 'num'}, 'Like'), h('th', {}, 'Priority'), h('th', {}, 'Why')])));
      const tb = h('tbody', {});
      let changed = 0;
      Object.entries(res).forEach(([ref, v]) => {
        tb.append(h('tr', {}, [
          h('td', {}, h('span', {class: 'strong'}, ref + ' '), itemText(ref)),
          h('td', {class: 'num'}, String(v.severity ?? '–')), h('td', {class: 'num'}, String(v.likelihood ?? '–')),
          h('td', {}, h('span', {class: 'chip ' + (v.priority === 'High' ? 'crit' : v.priority === 'Low' ? 'mut' : 'warn')}, v.priority || '–')),
          h('td', {}, v.why || '')]));
        const act = S.actions.find(a => a.obsId === o.id && a.ref === ref);
        if (act && v.priority && act.priority !== v.priority) changed++;
      });
      t.append(tb);
      out.append(h('div', {class: 'tbl-wrap'}, t));
      if (changed) {
        out.append(h('button', {class: 'btn sm primary', style: 'margin-top:10px', onclick: () => {
          let n = 0;
          Object.entries(res).forEach(([ref, v]) => {
            const act = S.actions.find(a => a.obsId === o.id && a.ref === ref);
            if (act && v.priority && act.priority !== v.priority) { act.priority = v.priority; n++; }
          });
          saveAct(); toast('Updated priority on ' + n + ' corrective action(s)', 'good'); modal.close();
        }}, '↻ Apply to ' + changed + ' corrective action(s)'));
      }
    } catch (err) { out.textContent = ''; out.append(h('div', {class: 'chip crit'}, '⚠ ' + err.message)); }
    goB.disabled = false; goB.textContent = old;
  }}, '✦ Score findings');
  modal.open({title: 'Severity scoring — ' + o.id, body, foot: [goB, h('button', {class: 'btn sm', onclick: () => modal.close()}, 'Close')]});
  goB.click();
}

/* ---------------- Reports tab ---------------- */
function aiTabReports(V) {
  const months = [...new Set(S.obs.map(o => mKey(o.date)))].sort().reverse();
  const c = h('div', {class: 'card'}, h('h3', {}, 'Monthly BBS report'),
    h('div', {class: 'hint'}, 'A formal report drafted from that month\'s data — ready to circulate to HODs and plant leadership'));
  const mSel = selEl(months.map(m => [m, mLabel(m)]), months[0] || '', () => {});
  const out = h('div', {style: 'margin-top:12px'});
  let text = '';
  const genB = h('button', {class: 'btn primary sm', onclick: async () => {
    if (!mSel.value) { toast('No data months available — load demo data or record an observation', 'warn'); return; }
    text = await runAi(genB, out, d => aiMonthlyReport(mSel.value, d), 'Drafting…') || '';
    [copyB, dlB, prB, hiB].forEach(b => b.style.display = text ? '' : 'none');
  }}, '✦ Generate report');
  const copyB = h('button', {class: 'btn sm', style: 'display:none', onclick: async () => { try { await navigator.clipboard.writeText(text); toast('Copied', 'good'); } catch (e) { toast('Copy failed', 'bad'); } }}, '⧉ Copy');
  const dlB = h('button', {class: 'btn sm', style: 'display:none', onclick: () => dl('IGL_BBS_Report_' + mSel.value + '.md', new Blob([text], {type: 'text/markdown'}))}, '⬇ Download .md');
  const prB = h('button', {class: 'btn sm', style: 'display:none', onclick: () => printMarkdown('BBS Monthly Report — ' + mLabel(mSel.value), text)}, '🖨 Print / PDF');
  const hiB = h('button', {class: 'btn sm', style: 'display:none', onclick: async e => {
    const src = text; const t = await runAi(e.target, out, d => aiTranslate(src, 'hindi', d), 'Translating…'); if (t) text = t;
  }}, 'अ हिंदी');
  c.append(h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center'}, mSel, genB, copyB, dlB, prB, hiB), out);
  V.append(c);

  const g = h('div', {class: 'grid g3', style: 'margin-top:14px'});
  g.append(
    aiToolCard('📰', 'Weekly digest', 'Last 7 days vs the week before — for the plant head', () => aiOutputModal('Weekly digest', d => aiDigest(7, d))),
    aiToolCard('🗓', 'Fortnightly digest', 'Last 14 days, same format', () => aiOutputModal('Fortnightly digest', d => aiDigest(14, d))),
    aiToolCard('⚙', 'CAPA review', 'Close-first list, duplicate clusters and verification steps', () => aiOutputModal('Corrective action review', d => aiActionReview(d)))
  );
  V.append(g);
}

/** Print any markdown as a clean IGL-headed document (works as Save-as-PDF). */
function printMarkdown(title, md) {
  const pa = $('#print-area'); pa.textContent = '';
  pa.append(h('h2', {}, 'India Glycols Limited'), h('div', {class: 'note', style: 'color:#555'}, title + ' · generated ' + new Date().toLocaleString('en-IN')));
  pa.append(h('hr', {style: 'margin:10px 0'}));
  pa.append(mdToHtml(md));
  window.print();
}
