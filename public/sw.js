// Minimal service worker — its only job is to exist, so Chrome/Android treat
// this site as an installable PWA. It deliberately does NOT cache anything:
// this is a live dashboard (auth state, moderation data, etc.), so serving
// stale content offline would be actively misleading. Every request just
// passes straight through to the network, same as if there were no service
// worker at all.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
