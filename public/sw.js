// Service Worker — network-first agar perubahan UI/fitur selalu segar, fallback cache saat offline
const CACHE = 'ultra-dl-v11';
const ASSETS = [
  '/', '/index.html', '/docs.html', '/share.html', '/offline.html',
  '/tos.html', '/privacy.html', '/dmca.html',
  '/style.css', '/script.js', '/i18n.js', '/manifest.webmanifest',
  '/vendor/qrcode.min.js', '/logo.png', '/og-logo.jpg', '/favicon.png', '/favicon.svg',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('/offline.html') : undefined)))
  );
});
