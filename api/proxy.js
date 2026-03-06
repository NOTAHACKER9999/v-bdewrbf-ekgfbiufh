// NexProxy - Vercel Edge Function Core
// Handles all HTTP/HTTPS proxying with full header rewriting

import { config } from "../config.js";

export const runtime = "edge";

// XOR codec for URL obfuscation
function xorEncode(str) {
  const key = 0x5a;
  return btoa([...str].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(""));
}
function xorDecode(str) {
  const key = 0x5a;
  try {
    return [...atob(str)].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join("");
  } catch { return str; }
}

// Rewrite all URLs in HTML/CSS/JS to go through the proxy
function rewriteUrls(text, baseUrl, contentType) {
  const base = new URL(baseUrl);
  const proxyBase = "/nexproxy/";

  // Helper: encode a URL for proxying
  const encode = (url) => {
    try {
      const abs = new URL(url, baseUrl).href;
      return proxyBase + xorEncode(abs);
    } catch { return url; }
  };

  if (contentType.includes("text/html")) {
    // Rewrite src, href, action, srcset attributes
    text = text
      .replace(/(src|href|action)=["']([^"']+)["']/gi, (m, attr, url) => {
        if (url.startsWith("data:") || url.startsWith("javascript:") || url.startsWith("#") || url.startsWith("mailto:")) return m;
        return `${attr}="${encode(url)}"`;
      })
      .replace(/srcset=["']([^"']+)["']/gi, (m, srcset) => {
        const rewritten = srcset.split(",").map(part => {
          const [u, ...rest] = part.trim().split(/\s+/);
          return [encode(u), ...rest].join(" ");
        }).join(", ");
        return `srcset="${rewritten}"`;
      })
      // Rewrite inline styles
      .replace(/url\(["']?([^)"']+)["']?\)/gi, (m, u) => `url("${encode(u)}")`)
      // Inject our client script into <head>
      .replace(/<head([^>]*)>/i, `<head$1>
<script>
  window.__nexproxy = {
    base: "${base.origin}",
    encode: function(url) {
      const key = 0x5a;
      try {
        const abs = new URL(url, "${baseUrl}").href;
        return "/nexproxy/" + btoa([...abs].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(""));
      } catch(e) { return url; }
    },
    decode: function(str) {
      const key = 0x5a;
      try { return [...atob(str)].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(""); } catch(e) { return str; }
    }
  };
  // Intercept history pushState/replaceState for SPA routing
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = function(s, t, url) { return _push(s, t, url ? window.__nexproxy.encode(url) : url); };
  history.replaceState = function(s, t, url) { return _replace(s, t, url ? window.__nexproxy.encode(url) : url); };
  // Fix fetch
  const _fetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      const url = typeof input === "string" ? input : input.url;
      const encoded = window.__nexproxy.encode(url);
      if (typeof input === "string") return _fetch(encoded, init);
      return _fetch(new Request(encoded, input), init);
    } catch(e) { return _fetch(input, init); }
  };
  // Fix XMLHttpRequest
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url, ...rest) {
    try { url = window.__nexproxy.encode(url); } catch(e) {}
    return _open.call(this, m, url, ...rest);
  };
  // Fix WebSocket
  const _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    try {
      const wsUrl = new URL(url);
      const encoded = encodeURIComponent(wsUrl.href);
      const proxyWs = location.origin.replace("https://", "wss://").replace("http://", "ws://") + "/ws/" + encoded;
      return new _WS(proxyWs, protocols);
    } catch(e) { return new _WS(url, protocols); }
  };
</script>`)
  } else if (contentType.includes("text/css")) {
    text = text.replace(/url\(["']?([^)"']+)["']?\)/gi, (m, u) => `url("${encode(u)}")`);
  } else if (contentType.includes("javascript")) {
    // Rewrite import() and fetch() calls in JS
    text = text
      .replace(/\bimport\s*\(["'`]([^"'`]+)["'`]\)/g, (m, u) => `import("${encode(u)}")`)
      .replace(/\bfetch\s*\(["'`]([^"'`]+)["'`]/g, (m, u) => `fetch("${encode(u)}"`);
  }
  return text;
}

// Hop-by-hop headers to strip
const HOP_BY_HOP = new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization",
  "te","trailer","transfer-encoding","upgrade","host","origin",
  "referer","x-forwarded-for","x-forwarded-host","x-forwarded-proto",
  "cf-connecting-ip","cf-ipcountry","cf-ray","cf-visitor"
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const encodedPath = url.searchParams.get("path") || url.pathname.replace("/nexproxy/", "");

  if (!encodedPath) {
    return new Response("NexProxy running", { status: 200 });
  }

  // Password check
  if (config.password) {
    const auth = req.headers.get("x-nexproxy-auth") || url.searchParams.get("auth");
    if (auth !== config.password) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Decode target URL
  let targetUrl;
  try {
    const key = 0x5a;
    targetUrl = [...atob(encodedPath)].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join("");
    new URL(targetUrl); // validate
  } catch {
    // Try raw URL
    try { targetUrl = decodeURIComponent(encodedPath); new URL(targetUrl); }
    catch { return new Response("Invalid URL", { status: 400 }); }
  }

  // Block list check
  for (const pattern of config.blockList) {
    if (new RegExp(pattern).test(targetUrl)) {
      return new Response("Blocked", { status: 403 });
    }
  }

  // Build forwarded headers
  const forwardHeaders = new Headers();
  for (const [k, v] of req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && !k.toLowerCase().startsWith("x-vercel")) {
      forwardHeaders.set(k, v);
    }
  }

  const target = new URL(targetUrl);
  forwardHeaders.set("host", target.host);
  forwardHeaders.set("origin", target.origin);
  forwardHeaders.set("referer", targetUrl);

  // Forward cookies (critical for Google/Discord/YouTube auth)
  const cookies = req.headers.get("cookie");
  if (cookies) forwardHeaders.set("cookie", cookies);

  // User-agent spoofing
  forwardHeaders.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
  forwardHeaders.set("accept-language", "en-US,en;q=0.9");
  forwardHeaders.set("sec-fetch-site", "same-origin");
  forwardHeaders.set("sec-fetch-mode", "navigate");
  forwardHeaders.set("sec-fetch-dest", "document");
  forwardHeaders.set("sec-ch-ua", '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"');
  forwardHeaders.set("sec-ch-ua-platform", '"Windows"');
  forwardHeaders.set("sec-ch-ua-mobile", "?0");

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = req.body;
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: "follow",
    });
  } catch (e) {
    return new Response(`Proxy fetch error: ${e.message}`, { status: 502 });
  }

  const contentType = response.headers.get("content-type") || "";
  const isText = contentType.includes("text/") || contentType.includes("javascript") || contentType.includes("json");

  // Build response headers
  const resHeaders = new Headers();
  for (const [k, v] of response.headers) {
    const kl = k.toLowerCase();
    if (HOP_BY_HOP.has(kl)) continue;
    if (kl === "content-security-policy" || kl === "content-security-policy-report-only") continue;
    if (kl === "x-frame-options") continue;
    if (kl === "location") {
      // Rewrite redirects
      try {
        const loc = new URL(v, targetUrl).href;
        const key = 0x5a;
        const encoded = btoa([...loc].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(""));
        resHeaders.set(k, "/nexproxy/" + encoded);
      } catch { resHeaders.set(k, v); }
      continue;
    }
    // Forward set-cookie for auth
    if (kl === "set-cookie") {
      const modified = v
        .replace(/Domain=[^;]+;?/gi, "")
        .replace(/Secure;?/gi, "")
        .replace(/SameSite=[^;]+;?/gi, "SameSite=None;");
      resHeaders.append(k, modified);
      continue;
    }
    resHeaders.set(k, v);
  }

  resHeaders.set("access-control-allow-origin", "*");
  resHeaders.set("access-control-allow-credentials", "true");
  resHeaders.set("access-control-allow-methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  resHeaders.set("access-control-allow-headers", "*");
  resHeaders.set("x-nexproxy-origin", target.origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: resHeaders });
  }

  // Stream or rewrite
  if (isText) {
    let text = await response.text();
    text = rewriteUrls(text, targetUrl, contentType);
    resHeaders.delete("content-encoding");
    resHeaders.set("content-type", contentType || "text/plain");
    return new Response(text, { status: response.status, headers: resHeaders });
  }

  // Binary/video: stream directly (supports Range for video)
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) resHeaders.set("accept-ranges", "bytes");

  return new Response(response.body, {
    status: response.status,
    headers: resHeaders,
  });
}
