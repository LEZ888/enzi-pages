const CACHE = 'beauty-salon-20260804194856';
const ORIGIN_SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ORIGIN_SHELL);}).then(function(){return self.skipWaiting();}).catch(function(){return self.skipWaiting();}));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === 'navigate'){
      e.respondWith(caches.match(req).then(function(cached){
        var net = fetch(req).then(function(resp){var cp=resp.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return resp;}).catch(function(){return undefined;});
        return cached || net;
      }));
      return;
    }
    e.respondWith(caches.match(req).then(function(c){return c || fetch(req);}));
    return;
  }
  e.respondWith(caches.match(req).then(function(cached){
    var net = fetch(req).then(function(resp){var cp=resp.clone();caches.open(CACHE).then(function(c){c.put(req,cp);});return resp;}).catch(function(){return cached;});
    return cached || net;
  }));
});
