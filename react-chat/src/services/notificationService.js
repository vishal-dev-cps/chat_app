/**
 * Notification Service
 * Handles browser notifications for the chat application
 */

// Request permission for notifications
export const requestNotificationPermission = async () => {
  try {
    // Check if the browser supports notifications
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    // If we already have permission, return true
    if (Notification.permission === 'granted') {
      return true;
    }

    // If permission was denied before, don't ask again
    if (Notification.permission === 'denied') {
      console.log('Notification permission was previously denied');
      return false;
    }

    // Request permission from the user
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Show a notification
export const showNotification = (title, options = {}) => {
  // Default options
  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    ...options
  };

  // Check if notifications are supported and permission is granted
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('Notifications not enabled or not supported');
    return;
  }

  // Use service worker if available, otherwise use regular notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, defaultOptions);
    }).catch(error => {
      console.error('Error showing notification with service worker:', error);
      // Fallback to regular notifications
      new Notification(title, defaultOptions);
    });
  } else {
    // Fallback for browsers that don't support service workers
    new Notification(title, defaultOptions);
  }
};

// Show a chat message notification
export const showChatNotification = (message, users = []) => {
  // Find the sender's info
  const sender = users.find(u => u.id === message.from) || { name: 'Someone' };
  const title = `New message from ${sender.name || 'Someone'}`;
  
  // Prepare notification options
  const options = {
    body: message.text.length > 50 
      ? `${message.text.substring(0, 50)}...` 
      : message.text,
    icon: sender.photoURL || '/favicon.ico',
    tag: `msg-${message.id}`, // Group similar notifications
    data: {
      url: window.location.href,
      userId: message.from
    }
  };

  showNotification(title, options);
};
