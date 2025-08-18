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
  'http://localhost:5173',  // Vite dev server
  'http://127.0.0.1:5173',  // Sometimes browsers use this
  process.env.FRONTEND_URL  // Any custom URL from env
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Basic health-check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Chat service is running' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  const { userId } = socket.handshake.auth || {};
  if (userId) {
    socket.join(userId); // each user has their own room
    console.log(`User connected: ${userId}`);
    // Notify others that this user is now online
    io.emit('user-status-update', { userId, status: 'online' });
  } else {
    console.warn('Socket connected without userId');
  }

  // Handle chat messages from clients
  socket.on('chat_message', (msg) => {
    try {
      // Deliver to intended recipient if provided
      if (msg && msg.to) {
        io.to(msg.to).emit('chat_message', msg);
      }
      // Echo back to sender for confirmation (optional)
      socket.emit('chat_message', msg);
    } catch (err) {
      console.error('Error handling chat_message:', err);
    }
  });


  // Typing indicator for private chat
  socket.on('typing-private', ({ from, to }) => {
    if (!to) return;
    io.to(to).emit('typing-private', { from });
    console.log(`typing-private: ${from} → ${to}`);
  });

  // === Group chat events ===
  socket.on('join-group', ({ groupId, userId }) => {
    socket.join(groupId);
    console.log(`${userId} joined group ${groupId}`);
  });

  socket.on('group-message', (message) => {
    const { groupId } = message || {};
    if (groupId) {
      io.to(groupId).emit('new-group-message', message);
      // TODO: save message to DB here
    }
  });

  socket.on('typing', ({ groupId, userId }) => {
    socket.to(groupId).emit('user-typing', { groupId, userId });
  });

  socket.on('seen', ({ groupId, userId, messageId }) => {
    socket.to(groupId).emit('message-seen', { groupId, userId, messageId });
    // TODO: update message status in DB
  });

  socket.on('reaction', ({ messageId, groupId, reaction, userId }) => {
    io.to(groupId).emit('message-reacted', { messageId, reaction, userId });
    // TODO: persist reaction to DB
  });

  socket.on('disconnect', () => {
    // Notify others that this user went offline
    io.emit('user-status-update', { userId, status: 'offline', lastSeen: Date.now() });
    console.log('Socket disconnected:', userId || socket.id);
  });

  socket.on('typing-private', ({ from, to }) => {
    if (!to) return;
    io.to(to).emit('typing-private', { from });
    console.log(`typing-private: ${from} → ${to}`);
  });

  socket.on('seen-private', ({ from, to }) => {
    if (!to) return;
    io.to(to).emit('seen-private', { from });
    console.log(`seen-private: ${from} → ${to}`);
  });


});

server.listen(PORT, () => {
  console.log(`Chat service running on port ${PORT}`);
});
