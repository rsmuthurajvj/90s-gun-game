'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const gameRoutes = require('./routes/game');
const { initSocket } = require('./socket/gameSocket');
const errorHandler = require('./middleware/errorHandler');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:4200';

const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ['GET', 'POST'] }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/90sgungame')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// REST routes
app.use('/api/games', gameRoutes);

// Socket.io
initSocket(io);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
