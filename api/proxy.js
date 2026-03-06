export default async function handler(req, res) {
  try {
    const encoded = req.query.url;
    if (!encoded) return res.status(400).send("Missing URL");

    const target = Buffer.from(encoded, "base64").toString("utf8");

    const response = await fetch(target, {
      headers: {
        "user-agent": req.headers["user-agent"] || "",
        "accept": req.headers["accept"] || "*/*"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    let body;

    if (contentType.includes("text/html")) {
      let text = await response.text();

      text = text
        .replace(/href="/g, `href="/api/proxy?url=`) 
        .replace(/src="/g, `src="/api/proxy?url=`);

      body = text;
    } else {
      body = await response.arrayBuffer();
    }

    res.setHeader("content-type", contentType);
    res.send(Buffer.from(body));

  } catch (err) {
    res.status(500).send("Proxy error");
  }
}
