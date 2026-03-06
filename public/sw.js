self.addEventListener("fetch",event=>{

const url=new URL(event.request.url);

if(url.searchParams.has("url")){

event.respondWith(fetch(event.request));

}

});
