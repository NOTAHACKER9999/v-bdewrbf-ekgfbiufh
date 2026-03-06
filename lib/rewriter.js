export function rewriteHTML(html){

return html
.replace(/href="/g,'href="/proxy?url=')
.replace(/src="/g,'src="/proxy?url=')
.replace(/action="/g,'action="/proxy?url=');

}

export function rewriteJS(js){

return js
.replace(/fetch\(/g,"proxyFetch(")
.replace(/XMLHttpRequest/g,"ProxyXHR")
.replace(/WebSocket/g,"ProxyWebSocket");

}
