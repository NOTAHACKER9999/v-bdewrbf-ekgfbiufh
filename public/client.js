navigator.serviceWorker.register("/sw.js");

function encode(url){
  return btoa(url);
}

window.go = function(){

  let url=document.getElementById("url").value;

  if(!url.startsWith("http")) url="https://"+url;

  const encoded=encode(url);

  const iframe=document.createElement("iframe");

  iframe.src="/proxy?url="+encoded;

  document.body.innerHTML="";
  document.body.appendChild(iframe);

};
