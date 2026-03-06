// NexProxy Configuration
export const config = {
  // Your deployed Vercel domain (set after first deploy)
  proxyDomain: process.env.PROXY_DOMAIN || "your-app.vercel.app",

  // Optional: password protect your proxy
  password: process.env.PROXY_PASSWORD || "",

  // Codec: xor | b64 | plain
  codec: "xor",

  // Block list (regex patterns)
  blockList: [],
};
