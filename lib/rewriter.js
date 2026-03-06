function encode(url){
  return "/proxy?url=" + Buffer.from(url).toString("base64");
}

function resolve(url,base){

  if(!url) return url;

  if(url.startsWith("data:")) return url;
  if(url.startsWith("javascript:")) return url;
  if(url.startsWith("#")) return url;

  if(url.startsWith("//")){
    return "https:" + url;
  }

  try{
    return new URL(url,base).href;
  }catch{
    return url;
  }

}

function rewriteAttr(html,attr,base){

  const regex=new RegExp(attr+'="([^"]*)"', "gi");

  return html.replace(regex,(m,u)=>{
    const abs=resolve(u,base);
    return `${attr}="${encode(abs)}"`;
  });

}

export function rewriteHTML(html,base){

  html=rewriteAttr(html,"href",base);
  html=rewriteAttr(html,"src",base);
  html=rewriteAttr(html,"action",base);
  html=rewriteAttr(html,"poster",base);
  html=rewriteAttr(html,"data-src",base);

  return html;

}
