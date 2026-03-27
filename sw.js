const CACHE = "budzetapp-v1";
const ASSETS = ["/", "/index.html", "/css/main.css", "/css/login.css", "/css/app.css", "/js/auth.js", "/js/data.js", "/js/ui.js", "/js/app.js", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match("/index.html"))));
});
