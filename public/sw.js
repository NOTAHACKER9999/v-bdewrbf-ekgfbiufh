self.addEventListener("fetch",event=>{

const url=new URL(event.request.url);

if(url.pathname.startsWith("/proxy")){

event.respondWith(handle(event.request));

}

});

async function handle(req){

const u=new URL(req.url);

const target=u.searchParams.get("url");

return fetch("/api/proxy?url="+target,{
method:req.method,
headers:req.headers
});

}
