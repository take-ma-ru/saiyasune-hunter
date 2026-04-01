// Service Worker for 最安値ハンター PWA
const CACHE_NAME = 'price-hunter-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js'
];

// Install event - cache files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Cache opened');
            // We don't necessarily cache all URLs on install since they may not exist yet
            // The fetch handler will cache them dynamically
            return Promise.resolve();
        }).catch((error) => {
            console.log('Cache open error:', error);
        })
    );
    self.skipWaiting();
});

// Activate event - claim clients
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // Skip cross-origin requests and external APIs
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        event.respondWith(fetch(request).catch(() => {
            // Return offline response for failed cross-origin requests if needed
            return new Response('Network error', {
                status: 408,
                statusText: 'Request Timeout'
            });
        }));
        return;
    }

    // Cache-first strategy for HTML, CSS, JS
    // Network-first strategy could be used instead
    event.respondWith(
        caches.match(request).then((response) => {
            // Return cached response if found
            if (response) {
                return response;
            }

            // Try network
            return fetch(request).then((response) => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }

                // Clone response before caching
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return response;
            }).catch(() => {
                // Return cached version if network fails
                // Or return a fallback offline page
                return caches.match('/index.html').then((response) => {
                    return response || new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            });
        })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification.tag);
    event.notification.close();

    // Open or focus the app window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if app is already open
            for (let client of clientList) {
                if (client.url === '/' || client.url.includes('index.html')) {
                    return client.focus();
                }
            }
            // If not open, open it
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event.notification.tag);
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    console.log('Message received in SW:', event.data);

    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        self.registration.showNotification(title, options);
    }

    // Handle skip waiting for updates
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Periodic background sync (optional - not widely supported yet)
// This would allow us to sync data periodically even when the app is closed
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);

    if (event.tag === 'sync-prices') {
        event.waitUntil(
            // Sync logic here
            Promise.resolve()
        );
    }
});

console.log('Service Worker loaded successfully');
