// Service Worker – Production-ready caching strategy
const CACHE_NAME = 'antigravity-v48';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// Install: cache shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // API calls: network-only (never cache)
    if (url.pathname.startsWith('/api')) return;

    // Hashed assets (JS/CSS from Vite build): cache-first (immutable)
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Google Fonts: cache-first (skip if cross-origin and not cacheable)
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 444, statusText: 'No Response' }));
            })
        );
        return;
    }

    // HTML: network-first (siempre fresco online → apunta a los assets nuevos;
    // cae a caché solo si no hay red). Evita el "se ve viejo" tras cada deploy.
    event.respondWith(
        fetch(event.request).then(response => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});
