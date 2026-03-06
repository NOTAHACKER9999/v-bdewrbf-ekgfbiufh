import { rewriteHTML } from "../lib/rewriter.js";

export default async function handler(req,res){

try{

const encoded=req.query.url;

const url=Buffer.from(encoded,"base64").toString();

const response=await fetch(url,{
method:req.method,
headers:req.headers
});

const type=response.headers.get("content-type")||"";

let body;

if(type.includes("text/html")){

const html=await response.text();

body=rewriteHTML(html,url);

}else{

body=await response.arrayBuffer();

}

res.setHeader("content-type",type);

res.send(Buffer.from(body));

}catch{

res.status(500).send("proxy error");

}

}
