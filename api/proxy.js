function encodeURL(url){
    return "/proxy?url="+Buffer.from(url).toString("base64");
}

function resolveURL(url, base){
    if(!url) return url;
    if(url.startsWith("data:") || url.startsWith("javascript:") || url.startsWith("#")) return url;
    if(url.startsWith("//")) return "https:"+url;
    try{ return new URL(url, base).href; }catch{return url;}
}

function rewriteHTML(html, base){
    // fix target attributes
    html = html.replace(/target="(_blank|_top|_parent)"/gi,'target="_self"');

    // rewrite links, scripts, forms, posters, data-src
    html = html.replace(/(href|src|action|poster|data-src)="([^"]*)"/gi,(m,attr,url)=>{
        return `${attr}="${encodeURL(resolveURL(url, base))}"`;
    });

    // rewrite meta refresh
    html = html.replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']([^"']+)["']\s*\/?>/gi,(m, content)=>{
        const parts = content.split(";");
        if(parts.length>1){
            let urlPart = parts[1].trim();
            if(urlPart.toLowerCase().startsWith("url=")){
                const url = urlPart.substring(4);
                const abs = resolveURL(url, base);
                return `<meta http-equiv="refresh" content="${parts[0]};url=${encodeURL(abs)}">`;
            }
        }
        return m;
    });

    return html;
}

function rewriteCSS(css, base){
    return css.replace(/url\(([^)]+)\)/g,(m,url)=>{
        const clean = url.replace(/['"]/g,"");
        return `url(${encodeURL(resolveURL(clean, base))})`;
    });
}

export default async function handler(req, res){
    try{
        const encoded = req.query.url;
        if(!encoded) return res.status(400).send("missing url");

        const padded = encoded + "===".slice((encoded.length + 3) % 4);
        const url = Buffer.from(padded.replace(/-/g,"+").replace(/_/g,"/"), "base64").toString();

        const response = await fetch(url, {
            method: req.method,
            headers: {
                "user-agent": req.headers["user-agent"] || "",
                "accept": req.headers["accept"] || "*/*",
                "accept-language":"en-US,en;q=0.9"
            },
            redirect: "manual"
        });

        // handle HTTP redirects
        if(response.status>=300 && response.status<400){
            const loc = response.headers.get("location");
            if(loc){
                const abs = new URL(loc, url).href;
                res.writeHead(302, {Location: encodeURL(abs)});
                return res.end();
            }
        }

        const contentType = response.headers.get("content-type") || "";
        let body;

        if(contentType.includes("text/html")){
            let html = await response.text();
            html = rewriteHTML(html, url);

            // inject runtime JS for navigation, search, fetch/XHR interception
            const inject = `<script>
function encode(u){return "/proxy?url="+btoa(u);}
function resolve(u){try{return new URL(u,location.href).href}catch{return u}}

/* trap links */
document.addEventListener("click", e=>{
    const a = e.target.closest("a");
    if(!a) return;
    const href = a.getAttribute("href");
    if(!href) return;
    if(href.startsWith("javascript:")) return;
    e.preventDefault();
    location.href = encode(resolve(href));
});

/* trap forms */
document.addEventListener("submit", e=>{
    const form = e.target;
    if(!form.action) return;
    e.preventDefault();
    const method = (form.method||"get").toLowerCase();
    const data = new FormData(form);
    let targetURL = form.action;
    if(method==="get"){
        const params = new URLSearchParams(data);
        targetURL = form.action + "?" + params.toString();
        location.href = encode(resolve(targetURL));
    } else {
        // for POST, fetch and replace body
        fetch(encode(resolve(targetURL)), {method:"POST", body: data}).then(r=>r.text()).then(html=>{
            document.open();
            document.write(html);
            document.close();
        });
    }
});

/* intercept fetch */
const originalFetch = window.fetch;
window.fetch = function(resource, opts){
    if(typeof resource==="string" && resource.startsWith("http")){
        resource = encode(resolve(resource));
    }
    return originalFetch(resource, opts);
};

/* intercept XHR */
const XHR = XMLHttpRequest;
window.XMLHttpRequest = function(){
    const xhr = new XHR();
    const open = xhr.open;
    xhr.open = function(method, url, ...rest){
        if(url.startsWith("http")) url = encode(resolve(url));
        return open.call(xhr, method, url, ...rest);
    };
    return xhr;
};

/* trap history */
const push = history.pushState; history.pushState = function(a,b,url){if(url) url=encode(resolve(url)); return push.call(this,a,b,url);}
const replace = history.replaceState; history.replaceState = function(a,b,url){if(url) url=encode(resolve(url)); return replace.call(this,a,b,url);}

/* trap direct window.location changes */
const loc = window.location;
Object.defineProperty(window,"location",{set:function(url){loc.href=encode(resolve(url));}, get:function(){return loc;}});
</script>`;

            html = html.replace("<head>", "<head>"+inject);
            body = html;

        } else if(contentType.includes("text/css")){
            const css = await response.text();
            body = rewriteCSS(css, url);
        } else {
            body = await response.arrayBuffer();
        }

        res.setHeader("content-type", contentType);
        if(body instanceof ArrayBuffer) res.send(Buffer.from(body));
        else res.send(body);

    }catch(e){
        res.status(500).send("proxy error");
    }
}
