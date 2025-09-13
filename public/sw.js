const CACHE_NAME = 'magpie-v1.0.0';
const API_CACHE_NAME = 'magpie-api-v1.0.0';
const IMAGE_CACHE_NAME = 'magpie-images-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/app.js',
  '/js/db.js', 
  '/js/api.js',
  '/js/camera-ocr.js',
  '/styles/main.css',
  '/styles/components.css',
  '/styles/books.css',
  '/styles/forms.css',
  '/images/magpie-main.png',
  '/images/magpie-square-icon.png',
  '/images/favicons/favicon.ico',
  '/images/favicons/favicon-16x16.png',
  '/images/favicons/favicon-32x32.png',
  '/images/favicons/apple-touch-icon.png',
  '/images/favicons/android-chrome-192x192.png',
  '/images/favicons/android-chrome-256x256.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

const API_ENDPOINTS = [
  '/api/books',
  '/api/search',
  '/api/external'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        return self.skipWaiting(); // Force activate immediately
      })
      .catch(error => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim(); // Take control of all clients
      })
  );
});

// Fetch event - network-first for API, cache-first for static assets, and handle images
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle cover images (from Amazon, O'Reilly, etc.)
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // Handle static assets with cache-first strategy
  event.respondWith(handleStaticRequest(request));
});

// Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  const imageHosts = [
    'm.media-amazon.com',
    'learning.oreilly.com',
    'images-na.ssl-images-amazon.com',
    'covers.openlibrary.org'
  ];
  
  return imageHosts.some(host => url.hostname.includes(host)) ||
         request.destination === 'image' ||
         /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname);
}

// Network-first strategy for API requests
async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, cache the response (for GET requests only)
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Network request failed, trying cache...', error);
    
    // If network fails, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If no cache, return offline response
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'No cached data available',
          data: []
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // For non-GET requests, return error
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'Cannot perform this action while offline'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('Serving from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Both cache and network failed for:', request.url);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await cache.match('/index.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Return generic offline response
    return new Response(
      'Offline - content not available',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }
}

// Cache-first strategy for images with long-term caching
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('Serving image from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    // Cache successful image responses (they don't change often)
    if (networkResponse.ok && networkResponse.status === 200) {
      // Clone the response for caching
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
      console.log('Cached new image:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('Image request failed for:', request.url, error);
    
    // Return a proper error response to trigger CSS fallback
    return new Response('', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

// Background sync for offline changes
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-books') {
    event.waitUntil(syncOfflineChanges());
  }
});

async function syncOfflineChanges() {
  try {
    // This would integrate with the IndexedDB to sync offline changes
    console.log('Syncing offline changes in background...');
    
    // Post message to all clients to trigger sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        action: 'sync-offline-changes'
      });
    });
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
  console.log('Push notification received:', event);
  
  const options = {
    body: 'Your books have been synced!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Collection',
        icon: '/icon-book.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Magpie Book Collection', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Listen for messages from main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Force update caches
    updateCaches();
  }
  
  if (event.data && event.data.type === 'CACHE_IMAGES') {
    // Pre-cache cover images
    preCacheCoverImages();
  }
});

async function updateCaches() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    console.log('Caches updated successfully');
    
    // Optionally pre-cache cover images from the current book collection
    await preCacheCoverImages();
  } catch (error) {
    console.error('Failed to update caches:', error);
  }
}

// Pre-cache cover images from the book collection
async function preCacheCoverImages() {
  try {
    console.log('Pre-caching cover images...');
    const response = await fetch('/api/books');
    const books = await response.json();
    
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const cachePromises = [];
    
    for (const book of books) {
      if (book.coverImageUrl && book.coverImageUrl.trim() !== '') {
        cachePromises.push(
          fetch(book.coverImageUrl)
            .then(response => {
              if (response.ok) {
                return imageCache.put(book.coverImageUrl, response);
              }
            })
            .catch(error => {
              console.log('Failed to pre-cache image:', book.coverImageUrl, error);
            })
        );
      }
    }
    
    await Promise.allSettled(cachePromises);
    console.log('Cover images pre-cached');
    
  } catch (error) {
    console.error('Failed to pre-cache cover images:', error);
  }
}

console.log('Service Worker loaded successfully');
