// ============================================================
// 🛣️ DevPulse - Endpoints Routes
// POST /api/endpoints             -> naya endpoint banao
// GET  /api/endpoints             -> saare endpoints laao
// GET  /api/endpoints/:slug/logs  -> ek endpoint ke logs
// PUT  /api/endpoints/:slug/chaos -> chaos settings save karo
// ============================================================
const express = require('express');
const router = express.Router();
const Endpoint = require('../models/Endpoint');
const WebhookLog = require('../models/WebhookLog');

// Random slug generator (hook-x7k2p9qz style)
const generateSlug = () => `hook-${Math.random().toString(36).substr(2, 9)}`;

// ---------- 1) NAYA ENDPOINT BANAO ----------
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Endpoint ka naam zaroori hai!' });
        }

        // Unique slug banao (collision ho to dobara try)
        let slug = generateSlug();
        let exists = await Endpoint.findOne({ slug });
        while (exists) {
            slug = generateSlug();
            exists = await Endpoint.findOne({ slug });
        }

        const endpoint = await Endpoint.create({
            name: name.trim(),
            description: description || '',
            slug,
        });

        console.log('✅ Naya endpoint ban gaya:', slug);
        res.status(201).json({ data: endpoint });
    } catch (err) {
        console.error('❌ Create endpoint error:', err.message);
        res.status(500).json({ message: 'Endpoint create nahi hua' });
    }
});

// ---------- 2) SAARE ENDPOINTS ----------
router.get('/', async (req, res) => {
    try {
        const endpoints = await Endpoint.find().sort({ createdAt: -1 });
        res.json({ data: endpoints });
    } catch (err) {
        console.error('❌ Fetch endpoints error:', err.message);
        res.status(500).json({ message: 'Endpoints load nahi hue' });
    }
});

// ---------- 3) EK ENDPOINT KE LOGS ----------
router.get('/:slug/logs', async (req, res) => {
    try {
        const logs = await WebhookLog.find({ slug: req.params.slug })
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ data: logs });
    } catch (err) {
        console.error('❌ Fetch logs error:', err.message);
        res.status(500).json({ message: 'Logs load nahi hue' });
    }
});

// ---------- 4) CHAOS SETTINGS UPDATE ----------
router.put('/:slug/chaos', async (req, res) => {
    try {
        const { chaosEnabled, delayMs, forcedStatus } = req.body;

        const endpoint = await Endpoint.findOneAndUpdate(
            { slug: req.params.slug },
            {
                chaos: {
                    enabled: !!chaosEnabled,
                    delayMs: Number(delayMs) || 0,
                    forcedStatus: forcedStatus ? Number(forcedStatus) : null,
                },
            },
            { returnDocument: 'after' }
        );

        if (!endpoint) {
            return res.status(404).json({ message: 'Endpoint nahi mila!' });
        }

        console.log(`🔥 Chaos update [${endpoint.slug}]:`, endpoint.chaos);
        res.json({ data: endpoint });
    } catch (err) {
        console.error('❌ Chaos update error:', err.message);
        res.status(500).json({ message: 'Chaos update nahi hui' });
    }
});

module.exports = router;