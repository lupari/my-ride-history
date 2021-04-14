const PRECACHE = 'precache-v1';
const RUNTIME = 'runtime';
// -v33
// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
    '/static/favicon.ico'
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', (evt) => {
  console.log('[ServiceWorker] Install');
  evt.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline page');
      return cache.addAll(PRECACHE_URLS);
    })
  );

  self.skipWaiting();
});

// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate', (evt) => {
  console.log('[ServiceWorker] Activate');
  evt.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== PRECACHE) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', event => {
    // DevTools opening will trigger these o-i-c requests, which this SW can't handle.
    // There's probably more going on here, but I'd rather just ignore this problem. :)
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
    // If we are to sync stuff with Strava we are going to have updated map content -> remove map data response from cache
    // Don't know service worker enough to come up with a better solution
    // Also don't cache sync requests, it's of no use
    if (event.request.url.match('^.*\/sync.*$')) {
        caches.open(RUNTIME).then(cache => cache.delete('/app'))
        return;
    }
    // Skip cross-origin requests, like those for Google Analytics.
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return caches.open(RUNTIME).then(cache => {
          // const options = event.request.url.match( '^.*\/sync.*$') ? { credentials: 'include' } : {};
          return fetch(event.request).then(response => {
            // Put a copy of the response in the runtime cache.
            return cache.put(event.request, response.clone()).then(() => {
              return response;
            });
          });
        });
      })
    );

});
