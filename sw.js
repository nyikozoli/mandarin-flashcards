// Offline support for the GitHub Pages version. The cache name changes with every build.
const CACHE = 'mandarin-hsk-830fdd430b';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so an update arrives as soon as you are online. After 3 seconds, or when offline, the saved copy is used.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  event.respondWith((async () => {
    const network = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    });
    try {
      const first = await Promise.race([network, new Promise((resolve) => setTimeout(resolve, 3000, 'slow'))]);
      if (first !== 'slow') return first;
      return (await fromCache()) || (await network);
    } catch (err) {
      const cached = await fromCache();
      if (cached) return cached;
      throw err;
    }
  })());
});
