// Service Worker — cache aset statis, network untuk API
const CACHE = 'ultra-dl-v5';
const ASSETS = [
  '/', '/index.html', '/docs.html', '/share.html', '/offline.html',
  '/tos.html', '/privacy.html', '/dmca.html',
  '/style.css', '/script.js', '/i18n.js', '/manifest.webmanifest',
  '/vendor/qrcode.min.js', '/favicon.svg',
  '/icons/icon-192.png', '/icons/icon-512.png',
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
  // API: selalu network
  if (u.pathname.startsWith('/api/')) return;
  // Navigasi: network-first, fallback cache/offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }
  // Aset: cache-first
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
