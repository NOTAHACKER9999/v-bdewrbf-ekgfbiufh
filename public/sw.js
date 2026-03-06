// NexProxy Service Worker
// Intercepts ALL fetches from the browser before they leave

const PROXY_PREFIX = "/nexproxy/";
const XOR_KEY = 0x5a;

function xorEncode(str) {
  return btoa([...str].map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join(""));
}

function shouldProxy(url) {
  const u = new URL(url);
  // Don't proxy same-origin nexproxy routes or the SW itself
  if (u.origin === location.origin) return false;
  if (url.includes("/sw.js")) return false;
  return true;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = req.url;

  // Already proxied
  if (url.includes(PROXY_PREFIX)) return;

  if (!shouldProxy(url)) return;

  // Proxy it
  const encoded = xorEncode(url);
  const proxyUrl = location.origin + PROXY_PREFIX + encoded;

  event.respondWith(
    fetch(new Request(proxyUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      mode: "cors",
      credentials: "include",
      redirect: "follow",
    }))
  );
});

// Handle WebSocket upgrade hints
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
