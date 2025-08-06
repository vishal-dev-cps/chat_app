// Simple Express + Socket.IO chat server
// Run with: node server.js
// Ensure you have installed dependencies: npm install express socket.io cors

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

// Basic health-check endpoint
app.get('/', (req, res) => {
  res.send('Socket.IO chat server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  const { userId } = socket.handshake.auth || {};
  if (userId) {
    socket.join(userId); // each user has their own room
    console.log(`User connected: ${userId}`);
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
    console.log('Socket disconnected:', userId || socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});
