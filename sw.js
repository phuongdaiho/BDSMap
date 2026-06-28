const CACHE = 'bandog-v12';
const CORE = [
  './index.html',
  './manifest.json',
  './lib/leaflet.css',
  './lib/leaflet.js',
  './lib/MarkerCluster.css',
  './lib/MarkerCluster.Default.css',
  './lib/leaflet.markercluster.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  const isExternal = url.includes('nominatim') || url.includes('telegra.ph') ||
                     url.includes('tile.openstreetmap') || url.includes('arcgisonline') ||
                     url.includes('tesseract') || url.includes('tessdata') ||
                     url.includes('firestore.googleapis') || url.includes('firebase') ||
                     url.includes('gstatic.com/firebasejs');
  if (isExternal) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // App shell + local libs: cache first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
