// Mission Log service worker. VERSION changes whenever any page changes.
const VERSION = '858ad1afc663';
const CACHE = 'mission-log-' + VERSION;
const FILES = ["./", "2026-11-11.html", "2026-11-18.html", "2026-11-25.html", "2026-12-02.html", "2026-12-09.html", "2026-12-16.html", "2026-12-23.html", "2026-12-30.html", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mission-log-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pages: network first (fresh weekly content), stored copy if offline or slower than 3 s.
// Everything else (icons, manifest): stored copy first.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (!isPage) {
    e.respondWith(caches.match(req, {ignoreSearch: true}).then(r => r || fetch(req)));
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const stored = cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req.url.split('?')[0], res.clone());
      return res;
    });
    const slow = new Promise(r => setTimeout(() => r(null), 3000));
    try {
      const first = await Promise.race([network, slow]);
      if (first) return first;
      return (await stored) || await network;
    } catch (err) {
      return (await stored) || (await cache.match('index.html')) || Response.error();
    }
  })());
});
