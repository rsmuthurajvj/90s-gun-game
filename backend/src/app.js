'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const gameRoutes = require('./routes/game');
const { initSocket } = require('./socket/gameSocket');
const errorHandler = require('./middleware/errorHandler');
const cors = require('cors');

// FRONTEND_URL may be a comma-separated list. The Capacitor Android app
// serves its files from https://localhost, so that origin is always allowed.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || 'http://localhost:4200').split(',').map((s) => s.trim()).filter(Boolean),
  'https://localhost',
  'http://localhost',
  'capacitor://localhost'
];
const corsOptions = { origin: allowedOrigins, methods: ['GET', 'POST'] };

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions, pingInterval: 10000, pingTimeout: 8000 });

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/90sgungame')
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// The app pings this when the online lobby opens, so a sleeping free-tier
// server starts waking up before the player taps "Create".
app.get('/health', (req, res) => res.json({ ok: true }));

// Publicly hosted static pages (e.g. /privacy.html for the Play Store listing).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/games', gameRoutes);

initSocket(io);

app.use(errorHandler);

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
