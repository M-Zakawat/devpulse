// 😈 DEVPULSE CHAOS ENGINE MIDDLEWARE
const Endpoint = require('../models/Endpoint');

const chaosMiddleware = async (req, res, next) => {
    try {
        const { slug } = req.params;

        // 1. Endpoint verify karo
        const endpoint = await Endpoint.findOne({ slug });
        if (!endpoint) {
            return res.status(404).json({ error: 'Endpoint not found!' });
        }

        req.endpoint = endpoint;
        req.chaosApplied = null;

        const chaos = endpoint.chaosConfig;

        // Chaos OFF hai? Seedha aage jao
        if (!chaos || !chaos.enabled) {
            return next();
        }

        // 2. ⏱️ DELAY INJECTION
        if (chaos.delay > 0) {
            console.log(`😈 CHAOS: ${slug} ko ${chaos.delay}ms delay de raha hoon...`);
            req.chaosApplied = { type: 'delay', ms: chaos.delay };
            await new Promise(resolve => setTimeout(resolve, chaos.delay));
            console.log(`⏱️ Delay complete, aage badh raha hoon`);
        }

        // 3. 💥 ERROR INJECTION
        if (chaos.errorStatus) {
            console.log(`💥 CHAOS: ${slug} ko forced ${chaos.errorStatus} error de raha hoon!`);
            return res.status(chaos.errorStatus).json({
                chaos: true,
                injectedBy: 'DevPulse Chaos Engine 😈',
                forcedStatus: chaos.errorStatus,
                message: `DevPulse ne artificially yeh ${chaos.errorStatus} error inject kiya hai!`
            });
        }

        next();
    } catch (err) {
        console.error('Chaos Middleware Error:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = chaosMiddleware;