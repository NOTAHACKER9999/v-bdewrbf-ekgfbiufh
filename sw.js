self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith("/api/proxy")) return;

  event.respondWith(handleProxy(event.request));
});

async function handleProxy(req) {
  return fetch(req);
}
