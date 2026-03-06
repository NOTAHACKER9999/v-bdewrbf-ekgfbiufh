export function rewriteHTML(html, base){

function wrap(url){
  if(!url) return url;

  if(url.startsWith("data:")) return url;
  if(url.startsWith("javascript:")) return url;

  try{
    const absolute=new URL(url,base).href;
    return "/proxy?url="+Buffer.from(absolute).toString("base64");
  }catch{
    return url;
  }
}

return html

.replace(/href="([^"]*)"/g,(m,u)=>`href="${wrap(u)}"`)

.replace(/src="([^"]*)"/g,(m,u)=>`src="${wrap(u)}"`)

.replace(/action="([^"]*)"/g,(m,u)=>`action="${wrap(u)}"`)

.replace(/srcset="([^"]*)"/g,(m,u)=>{

const parts=u.split(",");

const rewritten=parts.map(p=>{
const [url,size]=p.trim().split(" ");
return wrap(url)+" "+(size||"");
});

return `srcset="${rewritten.join(",")}"`;

});

}
