const CACHE='golf-bet-v12';
const ASSETS=['./','./index.html?v=12','./styles.css?v=12','./readable.css?v=12','./app-part1.js?v=12','./app-firebase-fix.js?v=12','./app-part2.js?v=12','./app-room-fix.js?v=12','./app-part3.js?v=12','./app-part4.js?v=12','./app-host-viewer.js?v=12','./app-personal-view.js?v=12','./app-reset-refresh.js?v=12','./app-v11.js?v=12','./app-v12.js?v=12','./manifest.webmanifest?v=12'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
});
