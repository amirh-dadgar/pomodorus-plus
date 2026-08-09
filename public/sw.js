// Offline service worker. Strategy:
// - On the first successful navigation (e.g. just opening the landing page),
//   we precache the core app pages (/, /app, /leaderboard, /u/local, /offline)
//   so a single online load makes the whole app usable offline.
// - navigations: network-first, falling back to the cached copy, then /offline.
// - /_next/static + icons: cache-first; the URLs are content-hashed or
//   effectively immutable, so once any page loads them they stay cached.
// Bump VERSION to invalidate everything after breaking changes.
const VERSION = "v4";
const PAGES = `pomodorus-pages-${VERSION}`;
const ASSETS = `pomodorus-assets-${VERSION}`;
const CORE_PAGES = [
  "/",
  "/app",
  "/leaderboard",
  "/u/local",
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      await Promise.all(
        CORE_PAGES.map((url) =>
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

// When any core page is fetched successfully, also warm the rest of the app so
// one online visit caches everything (landing -> timer + profile offline).
async function warmCorePages() {
  const cache = await caches.open(PAGES);
  await Promise.all(
    CORE_PAGES.map((url) =>
      cache.match(url).then(
        (hit) =>
          hit ||
          cache
            .add(new Request(url, { cache: "reload" }))
            .catch(() => {}),
      ),
    ),
  );
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Cache successful same-origin pages. Redirects (auth bounces) are
    // deliberately not cached.
    if (
      response.ok &&
      !response.redirected &&
      new URL(request.url).origin === self.location.origin
    ) {
      cache.put(request, response.clone());
      // Warm the rest of the app after a successful navigation.
      event.waitUntil(warmCorePages());
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
