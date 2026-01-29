var CACHE = 'hobodraft-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.url.indexOf('/api/') !== -1) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(JSON.stringify({error: 'Offline'}), {headers: {'Content-Type': 'application/json'}});
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(r) {
    return r || fetch(e.request).then(function(res) {
      if (res.ok && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    });
  }).catch(function() {
    return caches.match('/');
  }));
});
