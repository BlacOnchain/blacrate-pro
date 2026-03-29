const CACHE_NAME = 'blacrate-v1';
const ASSETS = [
    'index.php',
    'style.css',
    'script.js',
    'manifest.json',
    'https://cdn-icons-png.flaticon.com/512/10307/10307842.png'
];

// Install: Save files to cache
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Fetch: Serve from cache if offline
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});