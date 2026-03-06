export function openSiteDB(origin){

return new Promise((resolve,reject)=>{

const request=indexedDB.open("proxy-"+origin,1);

request.onupgradeneeded=e=>{
const db=e.target.result;
db.createObjectStore("storage");
};

request.onsuccess=e=>resolve(e.target.result);

request.onerror=e=>reject(e);

});

}

export async function setItem(origin,key,value){

const db=await openSiteDB(origin);

const tx=db.transaction("storage","readwrite");

tx.objectStore("storage").put(value,key);

}

export async function getItem(origin,key){

const db=await openSiteDB(origin);

return new Promise(resolve=>{

const tx=db.transaction("storage");

const req=tx.objectStore("storage").get(key);

req.onsuccess=()=>resolve(req.result);

});

}
