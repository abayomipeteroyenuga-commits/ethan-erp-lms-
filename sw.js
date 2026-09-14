const CACHE="ethan-erp-lms-v1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./config.js","./supabase-client.js","./assets/ethan-logo.jpeg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));