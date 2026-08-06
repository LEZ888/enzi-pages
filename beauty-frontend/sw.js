const CACHE = 'beauty-frontend-20260806210632';
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}).catch(function(){return self.skipWaiting();}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin){
    if (req.mode === 'navigate'){
      e.respondWith(fetch(req).then(function(r){var cp=r.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return r;}).catch(function(){return caches.match(req);}));
      return;
    }
    e.respondWith(caches.match(req).then(function(c){return c || fetch(req);}));
    return;
  }
  e.respondWith(caches.match(req).then(function(cached){
    var net = fetch(req).then(function(r){var cp=r.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return r;}).catch(function(){return cached;});
    return net || cached;
  }));
});
