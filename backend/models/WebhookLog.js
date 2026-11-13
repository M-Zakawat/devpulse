const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
    endpointSlug: { type: String, required: true, index: true },
    method: { type: String, default: 'POST' },
    headers: { type: Object }, // Shopify/Stripe ke headers save karenge
    body: { type: Object },    // Payload (JSON) save karenge
    receivedAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // 👈 YEH HAI TTL MAGIC! 86400s = 24 hours. Data khud delete ho jayega!
    }
});

module.exports = mongoose.model('WebhookLog', webhookLogSchema);