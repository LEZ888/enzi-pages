const CACHE = 'lesley-warehouse-v10';
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './logo.jpg', './supabase.min.js', './zxing.min.js', './html5-qrcode.min.js', './sw.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // 导航请求（打开页面 / 页内跳转）：network-first，保证永远拿到最新 HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy).catch(() => {}));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 静态资源：cache-first，命中即用；未命中再联网并回填
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && (url.origin === location.origin)) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
