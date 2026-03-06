// NexProxy - Vercel Edge Function
export const config = { runtime: "edge" };

const XOR_KEY = 0x5a;

function xorDecode(str) {
  try {
    return [...atob(str)].map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join("");
  } catch { return null; }
}

function xorEncode(str) {
  return btoa([...str].map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join(""));
}

function rewriteUrls(text, baseUrl, contentType) {
  const proxyBase = "/nexproxy/";

  const encode = (url) => {
    try {
      const abs = new URL(url, baseUrl).href;
      return proxyBase + xorEncode(abs);
    } catch { return url; }
  };

  if (contentType.includes("text/html")) {
    text = text
      .replace(/(src|href|action)=["']([^"'#][^"']*?)["']/gi, (m, attr, url) => {
        if (url.startsWith("data:") || url.startsWith("javascript:") || url.startsWith("mailto:")) return m;
        return attr + '="' + encode(url) + '"';
      })
      .replace(/url\(["']?([^)"'\s]+)["']?\)/gi, (m, u) => {
        if (u.startsWith("data:")) return m;
        return 'url("' + encode(u) + '")';
      })
      .replace(/(<head[^>]*>)/i, '$1<script>!function(){var P="/nexproxy/",K=0x5a;function E(u){try{return P+btoa([...u].map(c=>String.fromCharCode(c.charCodeAt(0)^K)).join(""))}catch(e){return u}}var of=window.fetch;window.fetch=function(i,o){try{var u=typeof i==="string"?i:i.url;if(!u.startsWith(location.origin)&&!u.startsWith("/")){var e=E(u);return typeof i==="string"?of(e,o):of(new Request(e,i),o)}}catch(e){}return of(i,o)};var ox=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{if(!u.startsWith(location.origin)&&!u.startsWith("/"))u=E(u)}catch(e){}return ox.apply(this,arguments)}}();<\/script>');
  } else if (contentType.includes("text/css")) {
    text = text.replace(/url\(["']?([^)"'\s]+)["']?\)/gi, (m, u) => {
      if (u.startsWith("data:")) return m;
      return 'url("' + encode(u) + '")';
    });
  }
  return text;
}

const HOP_BY_HOP = new Set([
  "connection","keep-alive","proxy-authenticate","proxy-authorization",
  "te","trailer","transfer-encoding","upgrade","host","origin",
  "x-forwarded-for","x-forwarded-host","x-forwarded-proto",
  "cf-connecting-ip","cf-ipcountry","cf-ray","cf-visitor"
]);

export default async function handler(req) {
  const url = new URL(req.url);
  // Get encoded path from the URL — everything after /nexproxy/
  const encodedPath = url.pathname.replace(/^\/nexproxy\//, "").replace(/^\//, "");

  if (!encodedPath) {
    return new Response("NexProxy OK", { status: 200 });
  }

  // Decode target URL
  let targetUrl = xorDecode(encodedPath);
  if (!targetUrl) {
    try { targetUrl = decodeURIComponent(encodedPath); } catch { return new Response("Bad URL", { status: 400 }); }
  }
  try { new URL(targetUrl); } catch { return new Response("Invalid URL", { status: 400 }); }

  // Build request headers
  const fwdHeaders = new Headers();
  for (const [k, v] of req.headers) {
    const kl = k.toLowerCase();
    if (!HOP_BY_HOP.has(kl) && !kl.startsWith("x-vercel")) fwdHeaders.set(k, v);
  }
  const target = new URL(targetUrl);
  fwdHeaders.set("host", target.host);
  fwdHeaders.set("referer", target.origin + "/");
  fwdHeaders.set("origin", target.origin);
  fwdHeaders.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
  fwdHeaders.set("accept-language", "en-US,en;q=0.9");

  const body = (req.method !== "GET" && req.method !== "HEAD") ? req.body : undefined;

  let upstream;
  try {
    upstream = await fetch(targetUrl, { method: req.method, headers: fwdHeaders, body, redirect: "follow" });
  } catch (e) {
    return new Response("Upstream error: " + e.message, { status: 502 });
  }

  const ct = upstream.headers.get("content-type") || "";
  const isText = ct.includes("text/") || ct.includes("javascript") || ct.includes("json");

  // Build response headers
  const resHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    const kl = k.toLowerCase();
    if (HOP_BY_HOP.has(kl)) continue;
    if (kl === "content-security-policy" || kl === "content-security-policy-report-only" || kl === "x-frame-options") continue;
    if (kl === "location") {
      try {
        const abs = new URL(v, targetUrl).href;
        resHeaders.set(k, "/nexproxy/" + xorEncode(abs));
      } catch { resHeaders.set(k, v); }
      continue;
    }
    if (kl === "set-cookie") {
      resHeaders.append(k, v.replace(/Domain=[^;]+;?\s*/gi, "").replace(/SameSite=[^;]+;?\s*/gi, "SameSite=None; ").replace(/Secure;?\s*/gi, ""));
      continue;
    }
    resHeaders.set(k, v);
  }
  resHeaders.set("access-control-allow-origin", "*");
  resHeaders.set("access-control-allow-credentials", "true");

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: resHeaders });

  if (isText) {
    let text = await upstream.text();
    text = rewriteUrls(text, targetUrl, ct);
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
    resHeaders.set("content-type", ct || "text/plain");
    return new Response(text, { status: upstream.status, headers: resHeaders });
  }

  if (req.headers.get("range")) resHeaders.set("accept-ranges", "bytes");
  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
