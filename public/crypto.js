const KEY="proxy-master-key";

async function getKey(){

return crypto.subtle.importKey(
"raw",
new TextEncoder().encode(KEY),
{name:"AES-GCM"},
false,
["encrypt","decrypt"]
);

}

export async function encrypt(text){

const iv=crypto.getRandomValues(new Uint8Array(12));

const key=await getKey();

const encrypted=await crypto.subtle.encrypt(
{name:"AES-GCM",iv},
key,
new TextEncoder().encode(text)
);

return JSON.stringify({
iv:Array.from(iv),
data:Array.from(new Uint8Array(encrypted))
});

}

export async function decrypt(payload){

const obj=JSON.parse(payload);

const key=await getKey();

const decrypted=await crypto.subtle.decrypt(
{name:"AES-GCM",iv:new Uint8Array(obj.iv)},
key,
new Uint8Array(obj.data)
);

return new TextDecoder().decode(decrypted);

}
