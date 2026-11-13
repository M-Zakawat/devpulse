require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ================== SOCKET.IO SETUP ==================
const io = new Server(server, {
    cors: { origin: "*" } // Frontend (React) ko allow karo
});

// io ko globally available banao (routes se access karne ke liye)
app.set('socketio', io);

// ================== MIDDLEWARE ==================
app.use(cors());          // React frontend allow
app.use(express.json());  // JSON body parser

// ================== MODELS ==================
const Endpoint = require('./models/Endpoint');
const WebhookLog = require('./models/WebhookLog');

// ================== WEBHOOK ROUTES ==================
const webhookRoutes = require('./routes/webhook');
app.use('/webhook', webhookRoutes);

// ================== ENDPOINT CREATION API ==================
// Dashboard ka "Create New Endpoint" button yeh call karega
app.post('/api/endpoints', async (req, res) => {
    try {
        const { name } = req.body;

        // Automatic Unique Slug Generator (e.g., hook-x7y8z9abc)
        const slug = `hook-${Math.random().toString(36).substr(2, 9)}`;

        const newEndpoint = await Endpoint.create({ slug, name });

        res.status(201).json({
            message: 'Endpoint created successfully!',
            webhook_url: `http://localhost:5000/webhook/${slug}`,
            data: newEndpoint
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all endpoints (Dashboard pe list dikhane ke liye)
app.get('/api/endpoints', async (req, res) => {
    try {
        const endpoints = await Endpoint.find().sort({ createdAt: -1 });
        res.json(endpoints);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET single endpoint (Chaos settings load karne ke liye)
app.get('/api/endpoints/:slug', async (req, res) => {
    try {
        const endpoint = await Endpoint.findOne({ slug: req.params.slug });
        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found!' });
        }
        res.json(endpoint);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 😈 UPDATE CHAOS RULES (Dashboard ke toggle switches yeh call karenge)
app.patch('/api/endpoints/:slug/chaos', async (req, res) => {
    try {
        const { slug } = req.params;
        const { enabled, delay, errorStatus } = req.body;

        const endpoint = await Endpoint.findOneAndUpdate(
            { slug },
            {
                chaosConfig: {
                    enabled: enabled || false,
                    delay: delay || 0,
                    errorStatus: errorStatus || null
                }
            },
            { new: true }
        );

        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found!' });
        }

        res.json({
            message: '😈 Chaos rules updated!',
            chaosConfig: endpoint.chaosConfig
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get logs for a specific endpoint (History dikhane ke liye)
app.get('/api/logs/:slug', async (req, res) => {
    try {
        const logs = await WebhookLog.find({ endpointSlug: req.params.slug })
            .sort({ receivedAt: -1 })
            .limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================== HEALTH CHECK ==================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'DevPulse Engine Running with Real-time! 🚀',
        socket: 'Active',
        database: 'Connected'
    });
});

// ================== SOCKET.IO CONNECTION HANDLER ==================
io.on('connection', (socket) => {
    console.log(`👤 Dashboard Connected: ${socket.id}`);

    // Jab frontend specific slug ko listen karna chahe (room join)
    socket.on('join-room', (slug) => {
        socket.join(slug);
        console.log(`📺 Socket joined room: ${slug}`);
    });

    socket.on('disconnect', () => {
        console.log(`👋 Dashboard Disconnected: ${socket.id}`);
    });
});

// ================== DATABASE CONNECTION ==================
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/devpulse')
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ================== START SERVER ==================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {   // 👈 server.listen (app.listen NAHI!)
    console.log(`🔥 DevPulse Backend running on port ${PORT}`);
});