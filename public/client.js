import { encrypt } from "./crypto.js";

async function encode(url){

const encrypted = await encrypt(url);

return btoa(encrypted);

}

window.go = async function(){

let url = document.getElementById("url").value;

if(!url.startsWith("http")) url="https://"+url;

const encoded = await encode(url);

const iframe=document.createElement("iframe");

iframe.src="/proxy?url="+encoded;

document.body.appendChild(iframe);

}

navigator.serviceWorker.register("/sw.js");
