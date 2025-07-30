import { io } from 'socket.io-client';

// Use Vite env variable if provided, otherwise fall back to localhost
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Single shared socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false, // we will connect manually once we have the userId
});

// Helper to (re)connect with auth payload (userId)
export function connectSocket(userId) {
  if (!userId) return;
  if (socket.connected) return;
  socket.auth = { userId };
  socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}
