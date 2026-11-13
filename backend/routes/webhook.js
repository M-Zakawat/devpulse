const express = require('express');
const router = express.Router();
const chaosMiddleware = require('../middleware/chaos');
const WebhookLog = require('../models/WebhookLog');

// Dynamic Catcher + Chaos Engine 😈
router.post('/:slug', chaosMiddleware, async (req, res) => {
    try {
        const { slug } = req.params;
        // Endpoint chaos middleware ne already verify kar liya!

        // Data save karo (TTL applied)
        const log = await WebhookLog.create({
            endpointSlug: slug,
            headers: req.headers,
            body: req.body
        });

        // 🔥 Real-time emit
        const io = req.app.get('socketio');
        io.to(slug).emit('new-webhook', log);

        res.status(200).json({
            message: 'Webhook received & broadcasted!',
            logId: log._id,
            chaos: req.chaosApplied  // Agar delay lagai toh yahan dikhega
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;