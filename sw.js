const CACHE = "ethan-learn-neon-v19";
const ASSETS = [
  "./","./index.html","./styles.css","./app.js","./config.js",
  "./neon-client.js","./neon-sdk.bundle.js","./course-narration-data.js","./digital-learning.js","./assets/ethan-logo.jpeg"
];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const isAppAsset=["/","/index.html","/styles.css","/app.js","/config.js","/neon-client.js","/neon-sdk.bundle.js","/course-narration-data.js","/digital-learning.js"].some(s=>url.pathname.endsWith(s));
  if(isAppAsset){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
