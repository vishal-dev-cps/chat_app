/* Service Worker for chat notifications */

self.addEventListener('install', event => {
  // Activate immediately once installed
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Claim clients so the SW starts controlling pages immediately
  event.waitUntil(self.clients.claim());
});

// Handle notification click – focus an existing tab or open a new one
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If we already have a matching tab, just focus it.
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
