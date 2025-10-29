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
  console.log('showNotification called with:', { title, options });
  
  // Default options
  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    ...options
  };

  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return;
  }

  // Check if we have permission
  if (Notification.permission === 'granted') {
    // Use service worker if available
    if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        console.log('Showing notification via service worker');
        registration.showNotification(title, defaultOptions)
          .catch(error => {
            console.error('Error showing notification with service worker:', error);
            // Fallback to regular notifications
            showFallbackNotification(title, defaultOptions);
          });
      }).catch(error => {
        console.error('Service worker registration error:', error);
        showFallbackNotification(title, defaultOptions);
      });
    } else {
      // Fallback for browsers that don't support service workers
      console.log('Service worker not available, using fallback');
      showFallbackNotification(title, defaultOptions);
    }
  } else if (Notification.permission !== 'denied') {
    // We need to ask the user for permission
    console.log('Requesting notification permission...');
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        // Try showing the notification again
        showNotification(title, options);
      }
    });
  } else {
    console.warn('Notifications are blocked by the user');
  }
};

// Fallback notification method
const showFallbackNotification = (title, options) => {
  try {
    console.log('Showing fallback notification');
    const notification = new Notification(title, options);
    
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      notification.close();
    };
    
    return notification;
  } catch (error) {
    console.error('Error showing fallback notification:', error);
  }
};

// Play notification sound
const playNotificationSound = () => {
  try {
    // Try to use Web Audio API for better control
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};

// Check if window is focused
const isWindowFocused = () => {
  return document.hasFocus();
};

// Show a chat message notification
export const showChatNotification = (message, users = []) => {
  console.log('showChatNotification called with:', { message, users });
  if (!message) return;

  const sender = users.find(u => u.id === message.from);
  const senderName = sender ? sender.name : 'Unknown';
  const notificationTitle = `New message from ${senderName}`;
  
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notifications');
    return;
  }

  // Check if we have permission to show notifications
  if (Notification.permission === 'granted') {
    const notification = new Notification(notificationTitle, {
      body: message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text,
      icon: sender?.avatar || '/favicon.ico',
      tag: `chat-${message.id || Date.now()}`,
      requireInteraction: true,
      renotify: true,
      silent: false
    });

    // Handle notification click
    notification.onclick = function(event) {
      event.preventDefault();
      window.focus();
      this.close();
    };

    // Play notification sound and update tab title if window is not focused
    if (!isWindowFocused()) {
      playNotificationSound();
      updateUnreadCount(1);
    }
    
    console.log('Chat notification shown');
  } 
  // Otherwise, request permission
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        showChatNotification(message, users); // Try again now that we have permission
      }
    });
  }
};

// Update unread count in tab title
const updateUnreadCount = (increment = 1) => {
  const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
  let newTitle = '';
  
  const match = document.title.match(/^\((\d+)\)\s*(.*)/);
  if (match) {
    const count = parseInt(match[1]) + increment;
    newTitle = `(${count}) ${match[2] || originalTitle}`;
  } else {
    newTitle = `(1) ${originalTitle}`;
  }
  
  document.title = newTitle;
};
