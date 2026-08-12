/* Daleko jeszcze? — service worker
   Caches the app shell (the page itself + fonts + the map-picker library)
   so the app can still open and track GPS progress with no internet —
   e.g. in airplane mode once the trip's route was already fetched online.

   This deliberately does NOT cache Mapbox/Nominatim/OSRM API calls or map
   tiles: those are live data and should always try the network first;
   the browser's normal HTTP cache already helps with repeat tile requests.
*/
const CACHE_NAME = 'daleko-jeszcze-v1';

const APP_SHELL = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('SW install: some assets failed to precache', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // only handle the app shell + the page navigation itself — everything
  // else (API calls, map tiles) passes straight through to the network
  // as if this service worker weren't there
  const isShellAsset = APP_SHELL.some((a) => req.url === a || req.url.endsWith(a.replace('./', '')));
  const isNavigation = req.mode === 'navigate';
  if (!isShellAsset && !isNavigation) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached); // offline — fall back to whatever we have cached
      // serve the cached copy immediately if we have one (fast + works
      // offline), while quietly refreshing it in the background for next time
      return cached || networkFetch;
    })
  );
});
