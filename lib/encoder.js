export function encodeURL(url){

return Buffer.from(url).toString("base64url");

}

export function decodeURL(url){

return Buffer.from(url,"base64url").toString();

}
