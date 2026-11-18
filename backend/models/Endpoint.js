// ============================================================
// 📦 DevPulse - Endpoint Model (chaos settings ke saath)
// ============================================================
const mongoose = require('mongoose');

const endpointSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Endpoint ka naam zaroori hai'],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true, // koi duplicate URL nahi
        },
        description: {
            type: String,
            default: '',
        },
        // Chaos testing settings - YE FIELD PEHLE MISSING THI!
        chaos: {
            enabled: { type: Boolean, default: false },
            delayMs: { type: Number, default: 0 },        // kitna delay (ms)
            forcedStatus: { type: Number, default: null }, // 500/502/504/429
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Endpoint', endpointSchema);