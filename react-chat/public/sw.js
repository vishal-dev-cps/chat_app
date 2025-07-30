/* Service Worker for chat notifications */

const CACHE_NAME = 'chat-notifications-v1';

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing Service Worker...');
  // Activate immediately once installed
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating Service Worker...');
  // Claim clients so the SW starts controlling pages immediately
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache the notification assets
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Handle push events (for Push API)
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = { title: 'New Message', body: 'You have a new message' };
  }

  const title = data.title || 'New Message';
  const options = {
    body: data.body || 'You have a new message',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.url || '/',
      userId: data.userId,
      timestamp: data.timestamp || Date.now()
    },
    vibrate: [200, 100, 200],
    tag: data.tag || 'chat-message',
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received:', event);
  
  // Close the notification
  event.notification.close();
  
  // Get the URL from the notification data or use the root
  const url = event.notification.data?.url || '/';
  
  // Focus the existing tab or open a new one
  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then(windowClients => {
      // Check if there's already a tab open with the chat
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open a new tab if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event);
});
