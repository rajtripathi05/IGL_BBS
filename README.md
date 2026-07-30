# IGL BBS — Behaviour Based Safety

Behaviour Based Safety observation system of **India Glycols Limited**, Kashipur.
Digitises the IGL **BBSO** checklist with dashboards, an analyser, corrective-action
tracking and optional AI assistance. Open to **all departments**.

Part of the [IGL HSE Portal](https://iglsafetymanagementsystem.netlify.app/) ecosystem.

---

## What it does

| Module | Purpose |
|---|---|
| **Dashboard** | Leading indicators — % safe trend vs target, observations per month, top at-risk categories, department scorecards, open/overdue actions |
| **New Observation** | Full IGL BBSO checklist — 11 categories, 78 items, Safe / At-Risk counters, remarks, corrected-on-spot and high-risk flags |
| **Observation Register** | Searchable register with detail view, print-ready BBSO sheet, Excel/CSV export |
| **Corrective Actions** | CAPA auto-created from at-risk items (high risk = 3-day due date, otherwise 7), with status and overdue tracking |
| **BBS Analyser** | Category, monthly, department and observer analysis — mirrors the BBS Checklist Analyser workbook |
| **AI Assistant** | OpenRouter-powered insights, checklist auto-fill from free text, CAPA suggestions, monthly report drafts, safety chat |
| **Settings** | Checklist editor, department/plant master data, targets, backup & restore, demo data |

### Summary maths (identical to the Excel workbook)

```
Total Safe    = Σ safe marks
Total At Risk = Σ at-risk marks
% Safe        = Total Safe / (Total Safe + Total At Risk) × 100
```

---

## Tech

Plain HTML, CSS and vanilla JavaScript — **no build step, no framework, no bundler**.

- Charts are hand-rolled SVG (no charting library) — tooltips, keyboard focus and a table view for every chart
- [SheetJS](https://sheetjs.com) is vendored in `vendor/` so Excel export works offline and behind the plant firewall
- Data is stored in the browser's `localStorage`; JSON backup/restore moves or merges data between machines
- Installable PWA with an offline service worker (`sw.js`)

```
IGL_BBS/
├── index.html                  app shell
├── css/app.css                 design tokens + all styling
├── js/
│   ├── 01-data.js              seed data, checklist, settings, storage
│   ├── 02-core.js              DOM helpers, SVG charts, filters, router
│   ├── 03-dashboard.js         dashboard + shared observation table
│   ├── 04-observation-form.js  new / edit observation
│   ├── 05-register.js          register, detail modal, print, exports
│   ├── 06-actions.js           corrective actions (CAPA)
│   ├── 07-analyser.js          BBS analyser
│   ├── 08-ai.js                OpenRouter integration
│   └── 09-settings.js          settings, demo data, app init
├── assets/                     IGL logo / favicon
├── vendor/xlsx.full.min.js     SheetJS (Apache-2.0)
├── manifest.webmanifest        PWA manifest
├── sw.js                       offline service worker
└── netlify.toml                Netlify config (headers, SPA redirect)
```

Load order matters — the scripts are numbered and loaded with `defer` in that sequence.

---

## Run locally

No tooling needed. Either open `index.html` directly, or serve it (required for the
service worker):

```bash
python -m http.server 8080
# then open http://localhost:8080
```

---

## Deploy to Netlify

**Publish directory:** `.` — **Build command:** *(none)*

### Option A — connect the GitHub repo (recommended: auto-deploys on every push)

1. Netlify → **Add new site → Import an existing project → GitHub**
2. Pick `rajtripathi05/IGL_BBS`, branch `main`
3. Build command: leave empty · Publish directory: `.`
4. **Deploy**

### Option B — drag and drop

Zip the contents of this folder and drop it on the site's **Deploys** tab.

### Option C — CLI

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=.
```

---

## Push to GitHub

Double-click **`setup-git.bat`** — it initialises (if needed), commits, sets the
remote and pushes.

Or from a terminal:

```bash
cd "C:\Users\ai\OneDrive - INDIA GLYCOLS LIMITED\Desktop\BBS"
git push -u origin main
```

The remote is already configured to `https://github.com/rajtripathi05/IGL_BBS`.

---

## OpenRouter AI (optional)

The app works fully without AI. To enable it:

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. In the app: **AI Assistant → OpenRouter setup** → paste the key → **Test connection**
3. Pick a model — `↻` loads the live model list; several `:free` models are available

The key is stored **only in that browser's** `localStorage` and is sent directly from
the browser to `openrouter.ai`. It is never committed, never proxied through Netlify,
and each user enters their own.

---

## Data & privacy

- Observations, actions and settings live in the browser — nothing is sent to a server
- **Settings → Export backup** produces a JSON file; **Import** can *merge* (departments send weekly, EHS consolidates) or *replace*
- Exported spreadsheets can contain employee information — `.gitignore` keeps `*.xlsx` / `*.csv` / backups out of the repo

To move to shared live data later, the storage layer is isolated in `js/01-data.js`
(`store`, `saveObs`, `saveAct`, `saveSet`) — swapping it for a database API is a
contained change.

---

## Releases

Version strings appear in three places — update all three together:

1. `index.html` — the `?v=` query on css/js tags
2. `sw.js` — `CACHE` constant and the `SHELL` list
3. `js/01-data.js` — `APP_VER`

---

Internal application of India Glycols Limited.
