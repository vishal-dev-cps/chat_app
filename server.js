// Simple Express + Socket.IO chat server
// Run with: node server.js
// Ensure you have installed dependencies: npm install express socket.io cors

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3001;

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://chat-site-85236.web.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

app.get('/health', (req, res) => {
  res.json({ status: 'Chat service is running' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,   // allow all origins safely behind Cloud Run
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],  // 🔥 IMPORTANT
  allowEIO3: true
});


// ===== USER SOCKET MAPPING =====
const userSockets = new Map();

io.on('connection', (socket) => {
  const { userId } = socket.handshake.auth || {};

  if (userId) {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.join(userId);
    io.emit('user-status-update', { userId, status: 'online' });
  }

  socket.on('authenticate', (userId) => {
    if (userId) {
      userSockets.set(userId, socket.id);
      socket.userId = userId;
      socket.join(userId);
    }
  });

  // ===== MESSAGE DELETION =====
  socket.on('delete-message', (data) => {
    const { messageId, userId1, userId2 } = data;
    if (!messageId || !userId1 || !userId2) return;

    const socket1 = userSockets.get(userId1);
    const socket2 = userSockets.get(userId2);

    if (socket1) io.to(socket1).emit('message-deleted', data);
    if (socket2) io.to(socket2).emit('message-deleted', data);
  });

  // ===== PRIVATE CHAT MESSAGE =====
  socket.on('chat_message', (msg) => {
    try {
      if (msg && msg.to) {
        io.to(msg.to).emit('chat_message', msg);
      }
      socket.emit('chat_message', msg);
    } catch { }
  });

  // Typing indicator for private chat
  socket.on('typing-private', ({ from, to }) => {
    if (!to) return;
    io.to(to).emit('typing-private', { from });
  });

  socket.on('seen-private', ({ from, to }) => {
    if (!to) return;
    io.to(to).emit('seen-private', { from });
  });

  // ===== GROUP EVENTS =====
  socket.on('join-group', ({ groupId }) => {
    socket.join(groupId);
  });

  socket.on('group-message', (message) => {
    const { groupId } = message || {};
    if (groupId) {
      io.to(groupId).emit('new-group-message', message);
    }
  });

  socket.on('typing', ({ groupId, userId }) => {
    socket.to(groupId).emit('user-typing', { groupId, userId });
  });

  socket.on('seen', ({ groupId, userId, messageId }) => {
    socket.to(groupId).emit('message-seen', { groupId, userId, messageId });
  });

  socket.on('reaction', ({ messageId, groupId, reaction, userId }) => {
    io.to(groupId).emit('message-reacted', { messageId, reaction, userId });
  });

  socket.on('disconnect', () => {
    const disconnectedUserId = socket.userId || socket.handshake.auth?.userId;

    if (disconnectedUserId) {
      userSockets.delete(disconnectedUserId);
      io.emit('user-status-update', {
        userId: disconnectedUserId,
        status: 'offline',
        lastSeen: Date.now()
      });
    }
  });
});

server.listen(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
