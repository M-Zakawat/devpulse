// ============================================================
// 📊 DevPulse - Analytics.jsx
// Bhai ye hamari analytics hai:
// 1. Stat cards: Total / Success / Errors / Chaos hits
// 2. Bar chart: pichhle 12 ghanton ka webhook traffic
// 3. Doughnut: Success vs Errors
// 4. Doughnut: HTTP methods ka ratio
// Sab kuch logs se calculate hota hai (24hr TTL wale logs)
// ============================================================

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Chart.js ke modules register karna ZAROORI hai (warna blank chart aata hai)
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const API = 'http://localhost:5000';

// Chhota stat card component
const StatCard = ({ icon, label, value, color }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
            <span className="text-xl">{icon}</span>
        </div>
        <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
);

export default function Analytics({ slug }) {
    const [logs, setLogs] = useState([]);

    // Slug change hote hi logs laao (await ke BAAD setState = warning safe)
    useEffect(() => {
        if (!slug) return;
        let cancelled = false; // purana data naya overwrite na kare
        (async () => {
            try {
                const res = await axios.get(`${API}/api/endpoints/${slug}/logs`);
                if (!cancelled) setLogs(res.data.data || res.data);
            } catch (err) {
                console.error('❌ Analytics load error:', err.message);
                if (!cancelled) setLogs([]);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

    // Refresh button (event handler me setState = allowed)
    const refresh = async () => {
        try {
            const res = await axios.get(`${API}/api/endpoints/${slug}/logs`);
            setLogs(res.data.data || res.data);
        } catch (err) {
            console.error('❌ Refresh error:', err.message);
        }
    };

    // ---------- CALCULATIONS ----------
    const getStatus = (l) => l.statusCode ?? l.status ?? 0;
    const total = logs.length;
    const successCount = logs.filter((l) => getStatus(l) >= 200 && getStatus(l) < 400).length;
    const errorCount = logs.filter((l) => getStatus(l) >= 400).length;
    const chaosCount = logs.filter((l) => l.chaosApplied).length;

    // Pichhle 12 ghanton ke buckets
    const now = new Date();
    const hourLabels = [];
    const hourCounts = Array(12).fill(0);
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        hourLabels.push(d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }));
    }
    logs.forEach((l) => {
        const diffH = Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / (60 * 60 * 1000));
        if (diffH >= 0 && diffH < 12) hourCounts[11 - diffH]++;
    });

    // Methods distribution
    const methodNames = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const methodCounts = methodNames.map(
        (m) => logs.filter((l) => (l.method || '').toUpperCase() === m).length
    );

    // ---------- CHART DATA ----------
    const hourlyData = {
        labels: hourLabels,
        datasets: [{
            label: 'Webhooks',
            data: hourCounts,
            backgroundColor: '#10b981',
            borderRadius: 6,
            maxBarThickness: 28,
        }],
    };

    const statusData = {
        labels: ['Success (2xx/3xx)', 'Errors (4xx/5xx)'],
        datasets: [{
            data: [successCount, errorCount],
            backgroundColor: ['#10b981', '#ef4444'],
            borderColor: '#18181b',
            borderWidth: 2,
        }],
    };

    const methodData = {
        labels: methodNames,
        datasets: [{
            data: methodCounts,
            backgroundColor: ['#38bdf8', '#10b981', '#fbbf24', '#a78bfa', '#ef4444'],
            borderColor: '#18181b',
            borderWidth: 2,
        }],
    };

    // ---------- CHART OPTIONS (dark theme) ----------
    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { ticks: { color: '#71717a', font: { size: 10 } }, grid: { color: '#27272a' } },
            y: { beginAtZero: true, ticks: { color: '#71717a', precision: 0 }, grid: { color: '#27272a' } },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#a1a1aa', boxWidth: 14, padding: 16 } },
        },
    };

    // ---------- EARLY RETURN (slug select nahi hua) ----------
    if (!slug) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="text-6xl mb-4">📊</span>
                <h2 className="text-xl font-bold text-zinc-300">Analytics</h2>
                <p className="text-zinc-500 mt-2">Pehle sidebar se koi endpoint select karo — phir uska pura data yahan aayega!</p>
            </div>
        );
    }

    // ---------- UI ----------
    return (
        <div className="space-y-6">

            {/* Header + Refresh */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                    📊 Analytics <span className="text-zinc-500 font-mono text-sm font-normal">/{slug}</span>
                </h2>
                <button onClick={refresh}
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2 text-sm font-medium">
                    🔄 Refresh
                </button>
            </div>

            {/* Empty data hint */}
            {total === 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
                    ⚠️ Is endpoint pe abhi koi webhook nahi aaya. Dashboard pe ja ke URL hit karo, phir Refresh dabao!
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="📥" label="Total Requests" value={total} color="text-white" />
                <StatCard icon="✅" label="Successful" value={successCount} color="text-emerald-400" />
                <StatCard icon="🔥" label="Errors" value={errorCount} color="text-red-400" />
                <StatCard icon="⚡" label="Chaos Hits" value={chaosCount} color="text-amber-400" />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Traffic - Last 12 Hours</h3>
                    <div className="h-64">
                        <Bar data={hourlyData} options={barOptions} />
                    </div>
                </section>

                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Success vs Errors</h3>
                    <div className="h-64">
                        <Doughnut data={statusData} options={doughnutOptions} />
                    </div>
                </section>
            </div>

            {/* Chart Row 2 */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">HTTP Methods Distribution</h3>
                <div className="h-56">
                    <Doughnut data={methodData} options={doughnutOptions} />
                </div>
            </section>
        </div>
    );
}