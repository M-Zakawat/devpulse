// ============================================================
// 🪝 DevPulse - Webhook Receiver (/hooks/:slug)
// SAB methods: GET, POST, PUT, PATCH, DELETE...
// Flow: Endpoint dhoondo -> Chaos -> Log save -> Socket emit -> Response
// ============================================================
const express = require('express');
const router = express.Router();
const Endpoint = require('../models/Endpoint');
const WebhookLog = require('../models/WebhookLog');

// router.all = har HTTP method pakarta hai
router.all('/:slug', async (req, res) => {
    try {
        // ---------- 1) Endpoint dhoondo ----------
        const endpoint = await Endpoint.findOne({ slug: req.params.slug });
        if (!endpoint) {
            return res.status(404).json({ message: 'Ye webhook URL maujood nahi hai! 🤷' });
        }

        // ---------- 2) CHAOS ENGINE (multi-layered: pehle delay, phir error) ----------
        let statusCode = 200;
        let chaosApplied = false;

        if (endpoint.chaos && endpoint.chaos.enabled) {
            chaosApplied = true;

            // Layer 1: DELAY injection (setTimeout promise hold)
            if (endpoint.chaos.delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, endpoint.chaos.delayMs));
            }

            // Layer 2: FORCE STATUS override
            if (endpoint.chaos.forcedStatus) {
                statusCode = endpoint.chaos.forcedStatus;
            }
        }

        // ---------- 3) X-RAY SNAPSHOT (log save - slug ke saath!) ----------
        const log = await WebhookLog.create({
            endpoint: endpoint._id,
            slug: endpoint.slug,
            method: req.method,
            path: req.originalUrl,
            headers: req.headers,
            query: req.query,
            body: req.body || {},
            statusCode,
            chaosApplied,
        });

        // ---------- 4) REAL-TIME EMIT (us endpoint ke room me) ----------
        const io = req.app.get('socketio');
        if (io) {
            io.to(endpoint.slug).emit('new-webhook', log);
            console.log(`📡 Webhook [${req.method}] /hooks/${endpoint.slug} -> ${statusCode}${chaosApplied ? ' (CHAOS 🔥)' : ''}`);
        }

        // ---------- 5) RESPONSE ----------
        res.status(statusCode).json({
            received: true,
            chaos: chaosApplied,
            message: chaosApplied
                ? `🔥 Chaos applied! Status ${statusCode} forced kiya gaya`
                : '✅ Webhook receive ho gaya',
        });
    } catch (err) {
        console.error('❌ Webhook receive error:', err.message);
        res.status(500).json({ message: 'Webhook process nahi hua' });
    }
});

module.exports = router;