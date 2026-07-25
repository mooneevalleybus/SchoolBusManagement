// School Bus Management — service worker
// Caches the app shell so the page still opens (with the last-loaded data
// visible in the UI, since that lives in the browser's JS memory/localStorage,
// not here) when there's no signal. Does NOT cache Microsoft Graph API calls —
// those always need a live network connection.

const CACHE_NAME = "school-bus-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for the app shell itself.
  // Everything else (Graph API, Microsoft login, etc.) goes straight to the network.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for the page itself, so the latest version loads whenever
  // there's a connection; fall back to the cached shell when offline.
  if (event.request.mode === "navigate" || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  if (SHELL_FILES.some((f) => url.pathname.endsWith(f.replace("./", "")))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
