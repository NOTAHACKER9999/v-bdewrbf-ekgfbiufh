function encode(u){
  return "/proxy?url="+Buffer.from(u).toString("base64");
}

function resolve(u,b){
  if(!u) return u;
  if(u.startsWith("data:") || u.startsWith("javascript:") || u.startsWith("#")) return u;
  if(u.startsWith("//")) return "https:"+u;
  try{ return new URL(u,b).href; }catch{return u;}
}

function rewriteHTML(html,base){
  html=html.replace(/target="(_blank|_top|_parent)"/gi,'target="_self"')
           .replace(/(href|src|action|poster|data-src)="([^"]*)"/gi,(m,a,u)=>{
             const abs=resolve(u,base);
             return `${a}="${encode(abs)}"`;
           })
           // rewrite meta refresh
           .replace(/<meta\s+http-equiv=["']refresh["']\s+content=["']([^"']+)["']\s*\/?>/gi,(m,content)=>{
             const parts=content.split(";");
             if(parts.length>1){
               let urlPart=parts[1].trim();
               if(urlPart.toLowerCase().startsWith("url=")){
                 const url=urlPart.substring(4);
                 const abs=resolve(url,base);
                 return `<meta http-equiv="refresh" content="${parts[0]};url=${encode(abs)}">`;
               }
             }
             return m;
           });
  return html;
}

function rewriteCSS(css,base){
  return css.replace(/url\(([^)]+)\)/g,(m,u)=>{
    let clean=u.replace(/['"]/g,"");
    const abs=resolve(clean,base);
    return `url(${encode(abs)})`;
  });
}

export default async function handler(req,res){
  try{
    const encoded=req.query.url;
    if(!encoded) return res.status(400).send("missing url");

    const padded=encoded+"===".slice((encoded.length+3)%4);
    const url=Buffer.from(padded.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString();

    const response=await fetch(url,{
      method:req.method,
      headers:{
        "user-agent":req.headers["user-agent"]||"",
        "accept":req.headers["accept"]||"*/*",
        "accept-language":"en-US,en;q=0.9"
      },
      redirect:"manual"
    });

    // handle HTTP redirects
    if(response.status>=300 && response.status<400){
      const loc=response.headers.get("location");
      if(loc){
        const abs=new URL(loc,url).href;
        res.writeHead(302,{Location:encode(abs)});
        return res.end();
      }
    }

    const type=response.headers.get("content-type")||"";
    let body;

    if(type.includes("text/html")){
      let html=await response.text();
      html=rewriteHTML(html,url);

      const inject=`<script>
function encode(u){return "/proxy?url="+btoa(u);}
function resolve(u){try{return new URL(u,location.href).href}catch{return u}}
/* trap all link clicks */
document.addEventListener("click",e=>{
  const a=e.target.closest("a"); if(!a) return;
  const href=a.getAttribute("href"); if(!href) return;
  if(href.startsWith("javascript:")) return;
  e.preventDefault();
  location.href=encode(resolve(href));
});
/* trap forms */
document.addEventListener("submit",e=>{
  const form=e.target; if(!form.action) return;
  e.preventDefault();
  const data=new FormData(form);
  const params=new URLSearchParams(data);
  location.href=encode(form.action+"?"+params.toString());
});
/* trap history API */
const push=history.pushState; history.pushState=function(a,b,url){if(url) url=encode(resolve(url)); return push.call(this,a,b,url)};
const replace=history.replaceState; history.replaceState=function(a,b,url){if(url) url=encode(resolve(url)); return replace.call(this,a,b,url)};
/* trap direct window.location changes */
Object.defineProperty(window,"location",{set:function(url){window.top.location.href=encode(resolve(url));},get:function(){return window.top.location;}});
</script>`;

      html=html.replace("<head>","<head>"+inject);
      body=html;

    } else if(type.includes("text/css")){
      const css=await response.text();
      body=rewriteCSS(css,url);

    } else {
      body=await response.arrayBuffer();
    }

    res.setHeader("content-type",type);
    if(body instanceof ArrayBuffer){
      res.send(Buffer.from(body));
    } else {
      res.send(body);
    }

  }catch(e){
    res.status(500).send("proxy error");
  }
}
