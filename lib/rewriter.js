function encode(url){
  return "/proxy?url=" + Buffer.from(url).toString("base64");
}

function resolve(url,base){

  if(!url) return url;

  if(url.startsWith("data:")) return url;
  if(url.startsWith("javascript:")) return url;
  if(url.startsWith("#")) return url;

  try{
    return new URL(url,base).href;
  }catch{
    return url;
  }

}

export function rewriteHTML(html,base){

  return html

  .replace(/href="([^"]*)"/gi,(m,u)=>{
    const abs=resolve(u,base);
    return `href="${encode(abs)}"`;
  })

  .replace(/src="([^"]*)"/gi,(m,u)=>{
    const abs=resolve(u,base);
    return `src="${encode(abs)}"`;
  })

  .replace(/action="([^"]*)"/gi,(m,u)=>{
    const abs=resolve(u,base);
    return `action="${encode(abs)}"`;
  })

  .replace(/srcset="([^"]*)"/gi,(m,u)=>{

    const parts=u.split(",");

    const rewritten=parts.map(p=>{
      const [url,size]=p.trim().split(" ");
      const abs=resolve(url,base);
      return encode(abs)+" "+(size||"");
    });

    return `srcset="${rewritten.join(",")}"`;

  });

}
