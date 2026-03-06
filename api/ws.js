// NexProxy WebSocket Tunnel (Edge)
// Tunnels WebSocket connections for Discord, Roblox, etc.

export const runtime = "edge";

export default async function handler(req) {
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const url = new URL(req.url);
  const encodedTarget = url.pathname.replace("/ws/", "");
  let targetWsUrl;
  try {
    targetWsUrl = decodeURIComponent(encodedTarget);
    new URL(targetWsUrl);
  } catch {
    return new Response("Invalid WebSocket URL", { status: 400 });
  }

  // Vercel Edge supports WebSocket upgrade via the WebSocket constructor
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();

  const target = new WebSocket(targetWsUrl);

  target.addEventListener("message", (e) => {
    try { server.send(e.data); } catch {}
  });
  target.addEventListener("close", (e) => {
    try { server.close(e.code, e.reason); } catch {}
  });
  target.addEventListener("error", () => {
    try { server.close(1011, "Target error"); } catch {}
  });

  server.addEventListener("message", (e) => {
    if (target.readyState === WebSocket.OPEN) {
      try { target.send(e.data); } catch {}
    }
  });
  server.addEventListener("close", (e) => {
    try { target.close(e.code, e.reason); } catch {}
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
