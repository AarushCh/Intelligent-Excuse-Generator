//  ─── simple cache‑first SW ───
const CACHE   = 'excusegen-v1';
const ASSETS  = [
  '/', '/static/style.css', '/static/manifest.json',
  '/static/logo.png', '/static/click.mp3',
  // add other static files you have
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; // let API calls pass through
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }))
  );
});