// Service worker Síly myšlenky: web jde přidat na plochu a denní nástroje fungují i bez internetu.
// Stránky: nejdřív síť, při výpadku uložená kopie, jinak offline.html.
// Styly, skripty a data: nejdřív síť (aby se úpravy webu projevily hned), offline z mezipaměti.
// Obrázky a fonty: hned z mezipaměti a na pozadí se obnoví.
// Audio se neukládá (je velké a přehrává se po částech).
const VERSION = 'sm-v1';
const CORE = [
  '/offline.html',
  '/muj-prostor.html',
  '/vecerni-zapis.html',
  '/male-kroky.html',
  '/kviz.html',
  '/dnesni-veta.html',
  '/assets/clanek.css',
  '/assets/prehravac.js',
  '/assets/events.js',
  '/assets/analytics.js',
  '/assets/icon.svg',
  '/assets/icons/icon-192.png',
  '/data/dnesni-veta.json',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.mp3') || req.headers.has('range')) return;

  const sameOrigin = url.origin === location.origin;
  const networkFirst = fallback => event.respondWith(
    fetch(req).then(res => {
      if (res.ok && sameOrigin) {
        const copy = res.clone();
        caches.open(VERSION).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (fallback ? caches.match(fallback) : Response.error())))
  );

  if (req.mode === 'navigate') return networkFirst('/offline.html');
  if (sameOrigin && /\.(css|js|json|webmanifest)$/.test(url.pathname)) return networkFirst();

  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  event.respondWith(
    caches.open(VERSION).then(cache => cache.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || fresh;
    }))
  );
});
