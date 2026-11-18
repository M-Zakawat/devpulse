// ============================================================
// ⚡ DevPulse - Backend Server (server.js) — v3 FIXED
// Fix: env load ab Node 22 ke BUILT-IN se (koi package nahi chahiye)
// Order: Env -> Imports -> App -> Middleware -> Routes -> Socket.io -> DB+Listen
// ============================================================

// ---------- 1) ENV LOAD (sab se pehle, Node 22 built-in) ----------
try {
    process.loadEnvFile(); // backend/.env khud load kar leta hai
    console.log('✅ .env load ho gayi');
} catch (e) {
    console.log('ℹ️ .env file nahi mili - default values use ho rahi hain');
}

// ---------- 2) IMPORTS ----------
const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

// Routes ke requires (routes folder me ye 3 files honi chahiye:
// endpoints.js, webhooks.js, analytics.js - naam alag hai to yahan theek karo)
const endpointRoutes = require('./routes/endpoints');
const webhookRoutes = require('./routes/webhook');
const analyticsRoutes = require('./routes/analytics');

// ---------- 3) APP BANAO (iske baad hi koi app.use!) ----------
const app = express(); // <-- app YAHAN paida hota hai

// ---------- 4) MIDDLEWARE ----------
app.use(cors({ origin: '*' })); // dev ke liye open CORS
app.use(express.json()); // JSON body parse - webhook payloads ke liye zaroori

// ---------- 5) ROUTES (app banne ke baad) ----------
// Health check - browser me http://localhost:5000 kholo to ye dikhega
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: '⚡ DevPulse API chal rahi hai!' });
});

app.use('/api/endpoints', endpointRoutes);   // endpoint CRUD + logs + chaos
app.use('/api/analytics', analyticsRoutes);  // analytics ka data
app.use('/hooks', webhookRoutes);            // webhook receiver (sab methods)

// ---------- 6) SOCKET.IO SETUP ----------
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// io ko app pe set karo - controllers me req.app.get('socketio') se milega
app.set('socketio', io);

io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Frontend specific endpoint ka room join karta hai
    socket.on('join-room', (slug) => {
        socket.join(slug);
        console.log(`👋 Socket ${socket.id} joined room: ${slug}`);
    });

    // Endpoint switch karte waqt purana room chhodo
    socket.on('leave-room', (slug) => {
        if (slug) {
            socket.leave(slug);
            console.log(`🚪 Socket ${socket.id} left room: ${slug}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// ---------- 7) DB CONNECT + SERVER START ----------
const PORT = process.env.PORT || 5000;
// Dono common naam check karo: MONGO_URI ya MONGODB_URI (jo .env me ho)
const MONGO_URI =
    process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devpulse';

mongoose
    .connect(MONGO_URI)
    .then(() => {
        // Password hai to mask kar ke dikhao (pro habit 😎)
        console.log('✅ Database connected successfully');
        server.listen(PORT, () => {
            console.log(`🔥 DevPulse backend chal gaya: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connect nahi hua:', err.message);
        process.exit(1);
    });