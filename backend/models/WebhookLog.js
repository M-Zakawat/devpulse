// ============================================================
// 📦 DevPulse - WebhookLog Model
// Har webhook ka "X-Ray snapshot" - 24hr baad khud delete (TTL)
// ============================================================
const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
    // Kis endpoint ka log hai
    endpoint: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Endpoint',
    },
    slug: {
        type: String,
        required: true,
        index: true, // tez search ke liye
    },
    // Request ki poori details
    method: { type: String, default: 'GET' },
    path: { type: String, default: '/' },
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Response jo humne wapas bheja
    statusCode: { type: Number, default: 200 },
    chaosApplied: { type: Boolean, default: false },
    // TTL INDEX: 86400 sec = 24 ghante baad Mongo khud delete karega
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400,
    },
});

module.exports = mongoose.model('WebhookLog', webhookLogSchema);