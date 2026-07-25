// Offline service worker. Strategy:
// - navigations: network-first, falling back to the cached copy of that
//   page, then to /offline. /app is cached on each successful visit (it
//   can't be precached: before sign-in it's just a redirect to /login).
// - /_next/static + icons: cache-first; the URLs are content-hashed or
//   effectively immutable.
// Bump VERSION to invalidate everything after breaking changes.
const VERSION = "v2";
const PAGES = `pomodorus-pages-${VERSION}`;
const ASSETS = `pomodorus-assets-${VERSION}`;
const PRECACHE = ["/", "/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== PAGES && name !== ASSETS) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Cache successful same-origin pages (notably /app) for offline use.
    // Redirects (auth bounces) are deliberately not cached.
    if (response.ok && !response.redirected && new URL(request.url).origin === self.location.origin) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    return (await cache.match("/offline")) ?? Response.error();
  }
}

async function handleAsset(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    /^\/(icon-|apple-icon|favicon)/.test(url.pathname)
  ) {
    event.respondWith(handleAsset(request));
  }
});
