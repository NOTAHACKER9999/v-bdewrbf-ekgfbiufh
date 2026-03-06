export function db(origin){

return new Promise((resolve,reject)=>{

const req=indexedDB.open("proxy-"+origin,1);

req.onupgradeneeded=e=>{
const db=e.target.result;
db.createObjectStore("s");
};

req.onsuccess=e=>resolve(e.target.result);

req.onerror=e=>reject(e);

});

}

export async function set(origin,key,value){

if(window.PROXY_INCOGNITO) return;

const database=await db(origin);

const tx=database.transaction("s","readwrite");

tx.objectStore("s").put(value,key);

}

export async function get(origin,key){

const database=await db(origin);

return new Promise(r=>{

const tx=database.transaction("s");

const req=tx.objectStore("s").get(key);

req.onsuccess=()=>r(req.result);

});

}
