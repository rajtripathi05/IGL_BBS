/* ============================================================
   IGL BBS · 11-app.js
   App shell — theme, command palette, shortcuts, mobile nav,
   global search, lightbox and boot
   ============================================================ */

/* ---------------- theme ---------------- */
function applyTheme(mode, {rerender = true} = {}) {
  const t = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  S.set.theme = t; saveSet();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#EEF2F6' : '#0A1C2E');
  paintThemeIcon();
  syncChartColors();
  if (rerender) VIEWS[S.view].r();
}
function paintThemeIcon() {
  const ico = $('#ico-theme'); if (!ico) return;
  const light = isLight();
  ico.textContent = '';
  if (light) {
    /* moon — click to go dark */
    ico.append(sv('path', {d: 'M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8z'}));
  } else {
    ico.append(sv('circle', {cx: 12, cy: 12, r: 4.5}),
      sv('path', {d: 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4'}));
  }
  $('#btn-theme').title = light ? 'Switch to dark theme' : 'Switch to light theme';
}
function applyDensity(d) {
  document.documentElement.setAttribute('data-density', d === 'compact' ? 'compact' : 'comfortable');
  S.set.density = d; saveSet();
}

/* ---------------- lightbox ---------------- */
function openPhoto(src) {
  $('#lightbox-img').src = src;
  $('#lightbox').classList.add('show');
}

/* ---------------- command palette ---------------- */
const CMD = {
  open: false, sel: 0, items: [],
  show(prefill = '') {
    this.open = true;
    $('#cmdk-wrap').classList.add('show');
    const i = $('#cmdk-input'); i.value = prefill; i.focus(); i.select();
    this.render();
  },
  hide() { this.open = false; $('#cmdk-wrap').classList.remove('show'); $('#cmdk-input').blur(); },
  build(q) {
    q = q.trim().toLowerCase();
    const out = [];
    const push = (grp, ic, label, sub, run) => out.push({grp, ic, label, sub, run});

    /* navigation + commands */
    const cmds = [
      ['Go to Dashboard', '▦', 'dashboard', () => showView('dashboard')],
      ['New observation', '＋', 'record a BBS observation', () => { F = null; showView('new'); }],
      ['Observation register', '☰', 'browse all records', () => showView('register')],
      ['Corrective actions', '✓', 'CAPA pipeline', () => showView('actions')],
      ['BBS Analyser', '⊞', 'category & trend analysis', () => showView('analyser')],
      ['AI Assistant', '✦', 'insights, reports, chat', () => showView('ai')],
      ['Settings', '⚙', 'master data, targets, backup', () => showView('settings')],
      ['Load demo data', '🎲', 'fill the app with sample records for testing', () => loadDemo()],
      ['Clear demo data', '🧹', 'remove only the demo records', () => clearDemo()],
      ['Toggle theme', '◐', 'switch light / dark', () => applyTheme(isLight() ? 'dark' : 'light')],
      ['Toggle density', '↕', 'compact / comfortable rows', () => { applyDensity(S.set.density === 'compact' ? 'comfortable' : 'compact'); VIEWS[S.view].r(); }],
      ['Export register (Excel)', '⬇', 'download the observation register', () => exportRegisterXlsx()],
      ['Export backup (JSON)', '⬇', 'full data backup', () => exportBackup()],
      ['Print this observation…', '🖨', 'open the register to print a record', () => showView('register')],
      ['Keyboard shortcuts', '⌨', 'show all shortcuts', () => showShortcuts()]
    ];
    cmds.forEach(([label, ic, sub, run]) => {
      if (!q || label.toLowerCase().includes(q) || sub.includes(q)) push('Commands', ic, label, sub, run);
    });

    if (q.length >= 2) {
      S.obs.filter(o => (o.id + ' ' + o.observer + ' ' + o.dept + ' ' + o.plant + ' ' + o.location + ' ' + o.job).toLowerCase().includes(q))
        .slice(0, 6).forEach(o => push('Observations', '▤', o.id + ' · ' + (o.job || o.location),
          dLabel(o.date) + ' · ' + o.observer + ' · ' + o.dept, () => { showView('register'); openObsDetail(o.id); }));
      S.actions.filter(a => (a.id + ' ' + a.desc + ' ' + (a.assignee || '')).toLowerCase().includes(q))
        .slice(0, 6).forEach(a => push('Actions', '⚙', a.id + ' · ' + a.desc.slice(0, 52),
          a.status + (a.due ? ' · due ' + dLabel(a.due) : ''), () => { showView('actions'); openActionModal(a.id); }));
      S.set.checklist.forEach(c => c.items.forEach(it => {
        if (it.text.toLowerCase().includes(q)) push('Checklist items', '☑', it.ref + ' ' + it.text, c.name,
          () => { F = null; showView('new'); setTimeout(() => { const el = $('#chk-search'); if (el) { el.value = it.text; el.dispatchEvent(new Event('input')); } }, 120); });
      }));
    }
    return out.slice(0, 24);
  },
  render() {
    const q = $('#cmdk-input').value;
    this.items = this.build(q);
    this.sel = Math.min(this.sel, Math.max(0, this.items.length - 1));
    const res = $('#cmdk-res'); res.textContent = '';
    if (!this.items.length) { res.append(h('div', {class: 'empty'}, 'Nothing matches “' + q + '”')); return; }
    let grp = '';
    this.items.forEach((it, i) => {
      if (it.grp !== grp) { grp = it.grp; res.append(h('div', {class: 'grp'}, grp)); }
      const row = h('div', {class: 'it' + (i === this.sel ? ' sel' : ''), onclick: () => { this.hide(); it.run(); }});
      row.addEventListener('mouseenter', () => { this.sel = i; this.paint(); });
      row.append(h('span', {class: 'ic'}, it.ic), h('span', {style: 'flex:1'}, it.label), h('span', {class: 'sub'}, it.sub || ''));
      res.append(row);
    });
  },
  paint() { $$('#cmdk-res .it').forEach((el, i) => el.classList.toggle('sel', i === this.sel)); },
  move(d) {
    if (!this.items.length) return;
    this.sel = (this.sel + d + this.items.length) % this.items.length;
    this.paint();
    const el = $$('#cmdk-res .it')[this.sel]; if (el) el.scrollIntoView({block: 'nearest'});
  },
  run() { const it = this.items[this.sel]; if (it) { this.hide(); it.run(); } }
};

function showShortcuts() {
  const rows = [
    ['Ctrl / ⌘ + K', 'Command palette & global search'],
    ['G then D', 'Go to Dashboard'], ['G then N', 'New observation'],
    ['G then R', 'Register'], ['G then A', 'Corrective actions'],
    ['G then Y', 'Analyser'], ['G then I', 'AI Assistant'], ['G then S', 'Settings'],
    ['N', 'New observation (from any list view)'],
    ['/', 'Focus the search box on this page'],
    ['T', 'Toggle light / dark theme'],
    ['Ctrl / ⌘ + S', 'Save the observation being edited'],
    ['Esc', 'Close dialog / palette']
  ];
  const b = h('div', {});
  const t = h('table', {});
  t.append(h('thead', {}, h('tr', {}, [h('th', {}, 'Shortcut'), h('th', {}, 'Action')])));
  const tb = h('tbody', {});
  rows.forEach(([k, v]) => tb.append(h('tr', {}, [h('td', {}, h('span', {class: 'kbd'}, k)), h('td', {}, v)])));
  t.append(tb); b.append(h('div', {class: 'tbl-wrap'}, t));
  modal.open({title: 'Keyboard shortcuts', body: b, foot: [h('button', {class: 'btn sm primary', onclick: () => modal.close()}, 'Close')]});
}

/* ---------------- demo data controls ---------------- */
function loadDemo(n) {
  genDemo(n);
  toast('Demo data loaded — ' + fmtN(demoCount()) + ' sample observations', 'good');
  showView('dashboard');
}
function clearDemo() {
  const n = demoCount();
  if (!n) { toast('No demo data to clear', 'warn'); return; }
  const ids = new Set(S.obs.filter(o => o.demo).map(o => o.id));
  S.obs = S.obs.filter(o => !o.demo);
  S.actions = S.actions.filter(a => !ids.has(a.obsId));
  saveObs(); saveAct(); updateCounts();
  toast(fmtN(n) + ' demo observations removed — your real records are untouched', 'good');
  VIEWS[S.view].r();
}
/** Always-available demo data control (topbar dice button). */
function demoMenu() {
  const body = h('div', {});
  body.append(h('div', {class: 'hint'},
    'Sample observations let you explore every dashboard, chart and report before real data exists. ' +
    'Demo records are tagged — clearing them never touches records you entered yourself.'));
  const stat = h('div', {class: 'stat-row', style: 'margin:12px 0'});
  stat.append(h('div', {}, h('b', {}, fmtN(S.obs.length)), 'observations total'),
    h('div', {}, h('b', {}, fmtN(demoCount())), 'of them demo'),
    h('div', {}, h('b', {}, fmtN(S.obs.length - demoCount())), 'entered by you'),
    h('div', {}, h('b', {}, fmtN(S.actions.length)), 'corrective actions'));
  body.append(stat);
  const row = h('div', {style: 'display:flex;gap:8px;flex-wrap:wrap'});
  [30, 60, 200].forEach(n => row.append(h('button', {class: 'btn' + (n === 60 ? ' primary' : ''), onclick: () => { modal.close(); loadDemo(n); }}, 'Load ' + n + ' records')));
  body.append(row);
  if (hasDemo()) body.append(h('div', {style: 'margin-top:12px'},
    h('button', {class: 'btn danger', onclick: () => { modal.close(); clearDemo(); }}, 'Clear ' + fmtN(demoCount()) + ' demo records')));
  body.append(h('div', {class: 'note', style: 'margin-top:12px'},
    'Records span the last 6 months with a slowly improving safety trend, so the charts show a realistic story.'));
  modal.open({title: 'Demo data', body, foot: [h('button', {class: 'btn sm', onclick: () => modal.close()}, 'Close')]});
}

function demoBar() {
  if (!hasDemo()) return null;
  const real = S.obs.length - demoCount();
  return h('div', {class: 'demo-bar'},
    h('span', {}, '🎲 '), h('b', {}, 'Demo mode'),
    h('span', {}, '— ' + fmtN(demoCount()) + ' sample observations are mixed into this view' + (real ? ' alongside ' + fmtN(real) + ' real record(s)' : '') + '.'),
    h('span', {class: 'grow'}),
    h('button', {class: 'btn sm', onclick: () => clearDemo()}, '🧹 Clear demo data'));
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  tip.el = $('#tip');
  applyDensity(S.set.density || 'comfortable');
  document.documentElement.setAttribute('data-theme', S.set.theme === 'light' ? 'light' : 'dark');
  paintThemeIcon();
  syncChartColors();

  $$('#nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $$('#mnav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  $('#burger').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#quick-new').addEventListener('click', () => { F = null; showView('new'); });
  $('#btn-theme').addEventListener('click', () => applyTheme(isLight() ? 'dark' : 'light'));
  $('#btn-search').addEventListener('click', () => CMD.show());
  $('#btn-demo').addEventListener('click', () => demoMenu());
  $('#modal-x').addEventListener('click', () => modal.close());
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') modal.close(); });
  $('#lightbox').addEventListener('click', () => $('#lightbox').classList.remove('show'));

  /* command palette wiring */
  $('#cmdk-input').addEventListener('input', () => { CMD.sel = 0; CMD.render(); });
  $('#cmdk-wrap').addEventListener('click', e => { if (e.target.id === 'cmdk-wrap') CMD.hide(); });

  /* keyboard */
  let gPending = 0;
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (CMD.open) return CMD.hide();
      if ($('#lightbox').classList.contains('show')) return $('#lightbox').classList.remove('show');
      return modal.close();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return CMD.show(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && S.view === 'new') { e.preventDefault(); return saveObservation(); }

    if (CMD.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); CMD.move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); CMD.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); CMD.run(); }
      return;
    }
    if (typing) return;

    const k = e.key.toLowerCase();
    if (Date.now() - gPending < 1200) {
      gPending = 0;
      const map = {d: 'dashboard', n: 'new', r: 'register', a: 'actions', y: 'analyser', i: 'ai', s: 'settings'};
      if (map[k]) { e.preventDefault(); if (k === 'n') F = null; showView(map[k]); return; }
    }
    if (k === 'g') { gPending = Date.now(); return; }
    if (k === 'n') { e.preventDefault(); F = null; showView('new'); return; }
    if (k === 't') { e.preventDefault(); applyTheme(isLight() ? 'dark' : 'light'); return; }
    if (k === '?') { e.preventDefault(); showShortcuts(); return; }
    if (k === '/') {
      const box = document.querySelector('.view.on input[type=search]');
      if (box) { e.preventDefault(); box.focus(); } else { e.preventDefault(); CMD.show(); }
    }
  });

  if (!store.persistent) toast('⚠ Browser storage unavailable — data will not persist. Export backups!', 'warn');
  showView('dashboard');
});
