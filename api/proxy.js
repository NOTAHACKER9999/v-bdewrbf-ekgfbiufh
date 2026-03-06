import { rewriteHTML } from "../lib/rewriter.js";

export default async function handler(req,res){

try{

const encoded=req.query.url;

if(!encoded) return res.status(400).send("missing url");

const url=Buffer.from(encoded,"base64").toString();

const response=await fetch(url,{
method:req.method,
headers:{
"user-agent":req.headers["user-agent"]||"",
"accept":req.headers["accept"]||"*/*"
}
});

const type=response.headers.get("content-type")||"";

let body;

if(type.includes("text/html")){

body=rewriteHTML(await response.text());

}else{

body=await response.arrayBuffer();

}

res.setHeader("content-type",type);

res.send(Buffer.from(body));

}catch(e){

res.status(500).send("proxy error");

}

}
