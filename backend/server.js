const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { pool, testConnection } = require('./config/database');

// Initialize express app first
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes AFTER app initialization
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const friendshipRoutes = require('./routes/friendships'); // Add this line

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friendships', friendshipRoutes); // Add this line

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CosmoChat Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Store active users and their socket connections
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Store user connection
  socket.on('user_online', (userId) => {
    activeUsers.set(userId, socket.id);
    console.log(`User ${userId} is online`);
    
    // Broadcast to friends that user is online
    socket.broadcast.emit('user_status_change', {
      userId: userId,
      status: 'online'
    });
  });

  // Handle joining conversations
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`User ${socket.id} left conversation ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      // Broadcast to all users in the conversation except sender
      socket.to(`conversation_${data.conversation_id}`).emit('new_message', data);
    } catch (error) {
      console.error('Socket message error:', error);
    }
  });

  socket.on('typing_start', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_stop_typing', {
      userId: data.userId
    });
  });

  // Handle incoming call
  socket.on('initiate_call', (data) => {
    const { toUserId, callType, conversationId } = data;
    const targetSocketId = activeUsers.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming_call', {
        fromUserId: socket.userId,
        callType: callType,
        conversationId: conversationId,
        callId: Date.now().toString()
      });
      console.log(`Call initiated to user ${toUserId}`);
    } else {
      // User is offline, handle accordingly
      socket.emit('call_failed', { reason: 'User offline' });
    }
  });

  // Handle call acceptance
  socket.on('accept_call', (data) => {
    const { callId, toUserId } = data;
    const targetSocketId = activeUsers.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_accepted', {
        callId: callId
      });
    }
  });

  // Handle call rejection
  socket.on('reject_call', (data) => {
    const { callId, toUserId } = data;
    const targetSocketId = activeUsers.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_rejected', {
        callId: callId
      });
    }
  });

  // Handle call end
  socket.on('end_call', (data) => {
    const { callId, toUserId } = data;
    const targetSocketId = activeUsers.get(toUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_ended', {
        callId: callId
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from active users
    for (let [userId, sockId] of activeUsers.entries()) {
      if (sockId === socket.id) {
        activeUsers.delete(userId);
        // Broadcast that user went offline
        socket.broadcast.emit('user_status_change', {
          userId: userId,
          status: 'offline'
        });
        break;
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await testConnection();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 CosmoChat Server running on port ${PORT}`);
      console.log(`📱 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;