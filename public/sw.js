const PROXY_PREFIX = "/nexproxy/";
const XOR_KEY = 0x5a;

function encode(str) {
  return btoa([...str].map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join(""));
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("fetch", event => {
  const url = event.request.url;
  const origin = self.location.origin;
  // Only proxy cross-origin requests
  if (url.startsWith(origin) || url.startsWith("chrome-extension")) return;
  const proxyUrl = origin + PROXY_PREFIX + encode(url);
  event.respondWith(fetch(new Request(proxyUrl, {
    method: event.request.method,
    headers: event.request.headers,
    body: ["GET","HEAD"].includes(event.request.method) ? undefined : event.request.body,
    mode: "cors",
    credentials: "include",
    redirect: "follow",
  })));
});
