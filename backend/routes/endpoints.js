// ============================================
// DevPulse — backend/routes/endpoints.js
// Endpoints CRUD + Chaos config yahan handle hoti hai
// ============================================
const express = require('express');
const router = express.Router();

const Endpoint = require('../models/Endpoint');
const WebhookLog = require('../models/WebhookLog');

// ----------------------------------------------------------
// Helper: unique slug generate karta hai (hook-xxxxxxxxx)
// Agar DB me collision ho to loop me dobara try karta hai
// ----------------------------------------------------------
const makeSlug = async () => {
    let slug;
    let exists = true;
    while (exists) {
        slug = 'hook-' + Math.random().toString(36).substring(2, 11);
        exists = await Endpoint.findOne({ slug });
    }
    return slug;
};

// ============================================================
// POST /api/endpoints → naya endpoint create
// ============================================================
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;

        // Name required — frontend bhi check karta hai, yeh double safety hai
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Endpoint name is required' });
        }

        const slug = await makeSlug();

        const endpoint = await Endpoint.create({
            name: name.trim(),
            description: description || '',
            slug,
            // Fresh endpoint pe chaos by default OFF rehta hai
            chaos: { enabled: false, delayMs: 0, forcedStatus: null },
        });

        res.status(201).json({ data: endpoint });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /api/endpoints → saare endpoints (dashboard sidebar)
// ============================================================
router.get('/', async (req, res) => {
    try {
        const endpoints = await Endpoint.find().sort({ createdAt: -1 });
        res.json({ data: endpoints });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /api/endpoints/:slug/logs → is endpoint ki logs (last 100)
// ============================================================
router.get('/:slug/logs', async (req, res) => {
    try {
        const logs = await WebhookLog.find({ slug: req.params.slug })
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ data: logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// PUT /api/endpoints/:slug/chaos → chaos config apply
//
// 🐛 BUG FIX YAHAN HUA:
// Purana code sirf 'chaosEnabled' destructure karta tha, lekin
// frontend 'enabled' bhejta hai → !!undefined = false → chaos
// kabhi ON nahi hota tha → har delivery instant 200 milti thi.
//
// Ab BULLETPROOF: har naming variant se value pick hoti hai —
// chaosEnabled / enabled / chaos.enabled / chaosConfig.enabled
// (delay aur status ke purane/naye naam bhi covered hain).
// ============================================================
router.put('/:slug/chaos', async (req, res) => {
    try {
        const b = req.body || {};

        // --- Chaos ON/OFF: koi bhi naam ho, pakro ---
        const chaosEnabled =
            b.chaosEnabled ?? b.enabled ?? b.chaos?.enabled ?? b.chaosConfig?.enabled ?? false;

        // --- Delay: naya 'delayMs' ya purana 'delay' ---
        const delayMs =
            Number(b.delayMs ?? b.delay ?? b.chaos?.delayMs ?? b.chaosConfig?.delay) || 0;

        // --- Forced status: 'forcedStatus' / 'status' / 'errorStatus' ---
        const statusRaw =
            b.forcedStatus ?? b.status ?? b.errorStatus ?? b.chaos?.forcedStatus ?? null;
        const forcedStatus = statusRaw ? Number(statusRaw) : null;

        const endpoint = await Endpoint.findOneAndUpdate(
            { slug: req.params.slug },
            {
                // Canonical chaos subdoc — webhooks.js ka chaos engine isi ko parhta hai
                chaos: {
                    enabled: !!chaosEnabled,
                    delayMs: delayMs,
                    forcedStatus: forcedStatus,
                },
                // Purane docs ka legacy field bhi sync rakhte hain (schema evolution)
                chaosConfig: {
                    enabled: !!chaosEnabled,
                    delay: delayMs,
                    errorStatus: forcedStatus,
                },
            },
            { returnDocument: 'after' } // updated doc wapis mile ga
        );

        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found' });
        }

        res.json({ data: endpoint });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;