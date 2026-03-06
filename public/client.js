const KEY="proxy-key";

function encode(url){
return btoa(url);
}

async function encrypt(data){

const key=await crypto.subtle.importKey(
"raw",
new TextEncoder().encode(KEY),
{name:"AES-GCM"},
false,
["encrypt"]
);

const iv=crypto.getRandomValues(new Uint8Array(12));

const enc=await crypto.subtle.encrypt(
{name:"AES-GCM",iv},
key,
new TextEncoder().encode(data)
);

return JSON.stringify({
iv:Array.from(iv),
data:Array.from(new Uint8Array(enc))
});

}

window.openProxy=function(){

let url=document.getElementById("url").value;

if(!url.startsWith("http")) url="https://"+url;

const iframe=document.createElement("iframe");

iframe.src="/proxy?url="+encode(url);

document.body.innerHTML="";

document.body.appendChild(iframe);

};

navigator.serviceWorker.register("/sw.js");

const originalFetch=window.fetch;

window.fetch=function(resource,opts){

if(typeof resource==="string" && resource.startsWith("http")){

resource="/proxy?url="+encode(resource);

}

return originalFetch(resource,opts);

};

const XHR=XMLHttpRequest;

window.XMLHttpRequest=function(){

const xhr=new XHR();

const open=xhr.open;

xhr.open=function(method,url,...rest){

if(url.startsWith("http")){

url="/proxy?url="+encode(url);

}

return open.call(xhr,method,url,...rest);

};

return xhr;

};
