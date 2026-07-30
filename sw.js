/* IGL BBS — service worker
   Offline-first app shell so observations can be recorded in the plant
   without network. Bump CACHE on every release. */

const CACHE = 'igl-bbs-v1.1.0';
const SHELL = [
  './',
  'index.html',
  'css/app.css?v=1.1.0',
  'js/01-data.js?v=1.1.0',
  'js/02-core.js?v=1.1.0',
  'js/03-dashboard.js?v=1.1.0',
  'js/04-observation-form.js?v=1.1.0',
  'js/05-register.js?v=1.1.0',
  'js/06-actions.js?v=1.1.0',
  'js/07-analyser.js?v=1.1.0',
  'js/08-ai.js?v=1.1.0',
  'js/09-settings.js?v=1.1.0',
  'js/10-ai-tools.js?v=1.1.0',
  'js/11-app.js?v=1.1.0',
  'vendor/xlsx.full.min.js',
  'assets/logo.png',
  'assets/favicon.png',
  'manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                              // never cache POSTs (OpenRouter API)
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                    // let AI calls hit the network directly

  /* network-first for the shell so a new deploy is picked up as soon as there is a connection */
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  /* cache-first for versioned static assets */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
