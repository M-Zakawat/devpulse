// ============================================================
// routes/analytics.js
// Sprint 4: Analytics Engine ka backend
// Kaam: ek slug ki saari requests ka SUMMARY REPORT nikalna
//
// VIVA POINT: MongoDB "Aggregation Pipeline" = SQL ka GROUP BY.
// Calculation DB ke andar hoti hai, humein sirf final numbers
// milte hain - network par hazaaron documents nahi bhejte.
// ============================================================

const express = require('express');
const router = express.Router();
const WebhookLog = require('../models/WebhookLog');

router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const now = new Date();

        // ---------- 1) Totals (stat cards ke liye) ----------
        const totalsArr = await WebhookLog.aggregate([
            { $match: { slug } }, // sirf is endpoint ke documents
            {
                $group: {
                    _id: null, // sab documents EK group mein
                    total: { $sum: 1 },
                    // $cond = ternary operator jaisa: agar statusCode < 400 hai to 1 gino warna 0
                    success: { $sum: { $cond: [{ $lt: ['$statusCode', 400] }, 1, 0] } },
                    failed: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
                    avgTime: { $avg: '$responseTimeMs' },
                },
            },
        ]);
        const totals = totalsArr[0] || { total: 0, success: 0, failed: 0, avgTime: 0 };

        // ---------- 2) Status code distribution (doughnut chart ke liye) ----------
        const statusDist = await WebhookLog.aggregate([
            { $match: { slug } },
            { $group: { _id: '$statusCode', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        // ---------- 3) Top event types (bar chart ke liye) ----------
        const topEvents = await WebhookLog.aggregate([
            { $match: { slug } },
            { $group: { _id: '$eventType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]);

        // ---------- 4) Last 12 hours ki timeline (line chart ke liye) ----------
        // $dateToString har document ki createdAt ko "2026-11-14 09" jaisi
        // hour-key banata hai (ye har MongoDB version pe chalta hai)
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        const raw = await WebhookLog.aggregate([
            { $match: { slug, createdAt: { $gte: twelveHoursAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d %H', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Gap filling: jis ghante mein 0 requests aayi, wo bhi 0 ke saath dikhaye
        const countsByHour = {};
        raw.forEach((r) => { countsByHour[r._id] = r.count; });
        const timeline = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            d.setMinutes(0, 0, 0);
            const key = d.toISOString().slice(0, 13).replace('T', ' '); // "2026-11-14 09"
            timeline.push({
                label: `${key.slice(11, 13)}:00`,
                count: countsByHour[key] || 0,
            });
        }

        res.json({
            totals: {
                total: totals.total,
                success: totals.success,
                failed: totals.failed,
                avgResponseTime: Math.round(totals.avgTime || 0),
                successRate: totals.total > 0 ? Math.round((totals.success / totals.total) * 100) : 0,
            },
            statusDistribution: statusDist.map((s) => ({ code: s._id, count: s.count })),
            topEvents: topEvents.map((e) => ({ event: e._id, count: e.count })),
            timeline,
        });
    } catch (err) {
        console.error('Analytics error:', err.message);
        res.status(500).json({ message: 'Analytics error: ' + err.message });
    }
});

module.exports = router;