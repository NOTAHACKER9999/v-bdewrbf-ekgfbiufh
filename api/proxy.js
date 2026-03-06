function encode(u){
return "/proxy?url="+Buffer.from(u).toString("base64");
}

function resolve(u,b){

if(!u) return u;

if(u.startsWith("data:")) return u;
if(u.startsWith("javascript:")) return u;
if(u.startsWith("#")) return u;

if(u.startsWith("//")) return "https:"+u;

try{
return new URL(u,b).href;
}catch{
return u;
}

}

function rewriteHTML(html,base){

return html

.replace(/(href|src|action|poster)="([^"]*)"/gi,(m,a,u)=>{

const abs=resolve(u,base);

return `${a}="${encode(abs)}"`;

});

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

if(!encoded) return res.status(400).send("missing");

const url=Buffer.from(encoded,"base64").toString();

const response=await fetch(url,{
method:req.method,
headers:{
"user-agent":req.headers["user-agent"]||"",
"accept":req.headers["accept"]||"*/*",
"accept-language":"en-US,en;q=0.9"
},
redirect:"manual"
});

if(response.status>=300 && response.status<400){

const loc=response.headers.get("location");

if(loc){

const abs=new URL(loc,url).href;

res.writeHead(302,{
Location:encode(abs)
});

return res.end();

}

}

const type=response.headers.get("content-type")||"";

let body;

if(type.includes("text/html")){

const html=await response.text();

body=rewriteHTML(html,url);

}

else if(type.includes("text/css")){

const css=await response.text();

body=rewriteCSS(css,url);

}

else{

body=await response.arrayBuffer();

}

res.setHeader("content-type",type);

if(body instanceof ArrayBuffer){
res.send(Buffer.from(body));
}else{
res.send(body);
}

}catch(e){

res.status(500).send("proxy error");

}

}
