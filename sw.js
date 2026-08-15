const CACHE = "neopress-v1";
const ASSETS = [
  "/neopress/ui/",
  "/neopress/ui/index.html",
  "/neopress/ui/styles.css",
  "/neopress/ui/app.js",
  "/neopress/ui/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // diario y datos: network-first (siempre frescos), fallback a cache
  if (url.pathname.includes("/diarios/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // assets estáticos: cache-first
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
