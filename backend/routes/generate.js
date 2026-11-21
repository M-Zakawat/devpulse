// backend/routes/generate.js
// Sprint 5 — Smart Payload API
const express = require('express');
const router = express.Router();
const { generatePayload, getProviders } = require('../services/payloadGenerator');

// GET /api/generate/providers — dropdown ke liye provider + events
router.get('/providers', (req, res) => {
    res.json({ providers: getProviders() });
});

// POST /api/generate — body: { provider, eventType } → fresh payload
router.post('/', (req, res) => {
    try {
        const { provider, eventType } = req.body;
        if (!provider || !eventType) {
            return res.status(400).json({ error: 'provider aur eventType dono bhejo' });
        }
        res.json(generatePayload(provider, eventType));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;