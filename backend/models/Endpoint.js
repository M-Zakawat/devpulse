const mongoose = require('mongoose');

const endpointSchema = new mongoose.Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        default: () => `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    name: { type: String, default: 'My Test Endpoint' },

    // 😈 CHAOS ENGINE CONFIG
    chaosConfig: {
        enabled: { type: Boolean, default: false },     // Chaos ON/OFF switch
        delay: { type: Number, default: 0 },            // Delay in ms (0-10000)
        errorStatus: { type: Number, default: null }    // Forced error (500/502/504/429)
    },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Endpoint', endpointSchema);