# NexProxy

A high-performance web proxy built for Vercel's Edge Runtime.

## Deploy

```bash
npm i -g vercel
unzip nexproxy.zip && cd nexproxy
vercel deploy
```

## How it works

- `api/proxy.js` — Vercel Edge Function that fetches and rewrites all proxied content
- `public/sw.js` — Service Worker that intercepts cross-origin fetches and routes them through the proxy
- `public/index.html` — Browser UI for navigating

## Features

- Full HTTP/HTTPS proxying
- HTML/CSS URL rewriting
- Cookie relay (Google, YouTube, Discord auth)
- CSP & X-Frame-Options stripping
- Service Worker fetch interception
- XOR URL obfuscation

## License
MIT
