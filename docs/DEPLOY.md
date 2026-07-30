# Deployment & handover guide — IGL BBS

## 1. Push the code to GitHub

The folder is already a git repository with one commit and the remote set.
Easiest route: **double-click `setup-git.bat`** in the project folder.

Manually:

```bash
cd "C:\Users\ai\OneDrive - INDIA GLYCOLS LIMITED\Desktop\BBS"
git push -u origin main
```

If GitHub asks for a password, use a **Personal Access Token** (Settings → Developer
settings → Personal access tokens → Fine-grained → repo `IGL_BBS`, Contents: Read/Write),
or install [GitHub CLI](https://cli.github.com/) and run `gh auth login` first.

If the repo already has commits and the push is rejected:

```bash
git pull --rebase origin main
git push -u origin main
```

## 2. Connect Netlify to the repo (auto-deploy on every push)

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. **Deploy with GitHub** → authorise → pick `rajtripathi05/IGL_BBS`
3. Branch `main` · Build command **empty** · Publish directory `.`
4. **Deploy site**, then **Site configuration → Change site name** → `igl-bbs`

Result: `https://igl-bbs.netlify.app`. Every `git push` redeploys automatically.

> A site named **igl-bbs** already exists in the account. Either link this repo to it
> (Site configuration → Build & deploy → Link repository) or delete it first.

## 3. Manual deploy (no GitHub)

Select everything **inside** the BBS folder (not the folder itself) → send to a ZIP →
drop the ZIP on the site's **Deploys** tab.

## 4. Link it from the HSE Portal

Add a card/menu entry in the portal pointing at `https://igl-bbs.netlify.app`.
The BBS app already links back to the portal in its sidebar and top bar.

## 5. Roll out to departments

1. Share the URL — no login, works on phone, tablet and desktop
2. On a phone: **Add to Home Screen** installs it as an app (works offline)
3. Each user sets their name/department once in **Settings → My defaults**
4. Weekly: departments use **Settings → Export backup**; EHS imports and chooses
   **Merge** to consolidate into one master view
5. EHS reviews **Corrective Actions** and closes items with verification remarks

## 6. Release checklist

- [ ] Bump the version in `index.html` (`?v=`), `sw.js` (`CACHE` + `SHELL`) and `js/01-data.js` (`APP_VER`)
- [ ] Test locally: `python -m http.server 8080`
- [ ] Check a new observation saves and the analyser totals match the Excel sheet
- [ ] `git commit` and `git push` — Netlify deploys within a minute
- [ ] Hard-refresh once (Ctrl+F5) to pick up the new service worker

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Old version still shows | Service worker cache — bump `CACHE` in `sw.js`, then Ctrl+F5 |
| Excel export does nothing | `vendor/xlsx.full.min.js` missing from the deploy — confirm the `vendor/` folder was uploaded |
| "Browser storage unavailable" warning | Private/incognito window or blocked storage — use a normal window |
| AI returns 401 | Bad or missing OpenRouter key (AI Assistant → Setup) |
| AI returns 402 | Out of OpenRouter credits — switch to a `:free` model |
| Data disappeared | Browser data was cleared — restore from the last JSON backup |
