import { StrictMode } from 'react';
import './utils/globalPopupOverride';

// Register service worker for notifications (must be before first render)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
      } else if (Notification.permission === 'granted') {
        console.log('Notifications are already granted');
      } else if (Notification.permission !== 'denied') {
        // Request permission from user
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
      }
    } catch (error) {
      console.error('ServiceWorker registration failed: ', error);
    }
  });
} else {
  console.warn('Service workers are not supported in this browser');
}

import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './whatsapp.css';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
