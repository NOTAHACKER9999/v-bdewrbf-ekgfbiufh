# NexProxy

A next-generation web proxy built for Vercel's Edge Runtime.

## Features

- ✅ Full HTTP/HTTPS proxying via Vercel Edge Functions
- ✅ Service Worker URL interception (all fetches, XHR, fetch())
- ✅ HTML/CSS/JS URL rewriting
- ✅ WebSocket tunneling (Discord, Roblox, etc.)
- ✅ Cookie relay for Google/YouTube auth passthrough
- ✅ Chunked video streaming with Range request support
- ✅ CSP/X-Frame-Options stripping
- ✅ XOR URL obfuscation
- ✅ SPA routing support (pushState/replaceState rewriting)

## Deploy

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Unzip and enter directory
unzip nexproxy.zip && cd nexproxy

# 3. Deploy
vercel deploy

# 4. Set your domain in config.js
```

## Configuration

Edit `config.js`:
- `proxyDomain`: Your Vercel deployment URL
- `password`: Optional access password
- `codec`: URL encoding method (xor recommended)
- `blockList`: Array of regex patterns to block

## Notes on Auth (Google, YouTube, Discord, Roblox)

The proxy forwards all cookies and uses browser-like headers.
For best results with authenticated sessions:
1. The service worker intercepts all same-origin fetches
2. Cookies are forwarded and rewritten (Domain stripped, SameSite=None)
3. OAuth flows are supported via redirect rewriting

Some services (Google, YouTube) use additional bot detection that may
require a residential IP. Consider pairing with a Cloudflare Worker or
residential proxy upstream for full auth support.

## License
MIT
