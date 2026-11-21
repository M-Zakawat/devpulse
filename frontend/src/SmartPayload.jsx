// frontend/src/SmartPayload.jsx
// Sprint 5 — AI-Assisted Smart Payload Panel 🧠
// Provider + event select karo → Faker engine fresh payload banata hai →
// ek click me active endpoint pe send. Live log me khud entry aati hai!

import { useState, useEffect } from 'react';
import ReactJson from '@microlink/react-json-view';

const API = 'http://localhost:5000';

// ── Chhote styles (dark theme match) ──
const selectStyle = {
    background: '#09090b', border: '1px solid #27272a', color: '#e4e4e7',
    padding: '8px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
};
const generateBtn = {
    background: '#27272a', border: '1px solid #3f3f46', color: '#fafafa',
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
};

export default function SmartPayload({ slug }) {
    const [providers, setProviders] = useState([]);
    const [provider, setProvider] = useState('');
    const [eventType, setEventType] = useState('');
    const [payload, setPayload] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    // 1) Component khulte hi providers lao (dropdown bharne ke liye)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API}/api/generate/providers`);
                const data = await res.json();
                if (!cancelled && data.providers) {
                    setProviders(data.providers);
                    setProvider(data.providers[0]?.id || '');
                    setEventType(data.providers[0]?.events[0] || '');
                }
            } catch (err) {
                console.error('❌ Providers load fail:', err.message);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // 2) Provider badla to uske events dikhao, purana payload hatao
    const handleProviderChange = (id) => {
        setProvider(id);
        const p = providers.find((x) => x.id === id);
        setEventType(p?.events[0] || '');
        setPayload(null);
        setResult(null);
    };

    // 3) Generate — engine se FRESH payload (har click pe naya data!)
    const handleGenerate = async () => {
        if (!provider || !eventType) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch(`${API}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, eventType }),
            });
            const data = await res.json();
            setPayload(data.payload);
            setMeta({ provider: data.provider, eventType: data.eventType });
        } catch (err) {
            console.error('❌ Generate fail:', err.message);
        } finally {
            setLoading(false);
        }
    };

    // 4) Send — active endpoint ke hook URL pe fire karo
    const handleSend = async () => {
        if (!payload || !slug) return;
        setSending(true);
        setResult(null);
        try {
            const res = await fetch(`${API}/hooks/${slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            setResult({ status: res.status, ok: res.ok });
        } catch (err) {
            setResult({ status: 0, ok: false });
            console.error('❌ Send fail:', err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            background: '#18181b', border: '1px solid #27272a',
            borderRadius: 12, padding: '16px 18px', marginBottom: 16,
        }}>
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ color: '#fafafa', margin: 0, fontSize: 15 }}>🧠 Smart Payload Generator</h3>
                <span style={{
                    fontSize: 10, background: '#10b98122', color: '#10b981',
                    padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                }}>SPRINT 5</span>
            </div>
            <p style={{ color: '#71717a', fontSize: 12, margin: '4px 0 14px' }}>
                GitHub / Stripe / Shopify jaisi REAL events — ek click me generate + send
            </p>

            {/* Controls: provider + event + generate */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <select
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    style={selectStyle}
                >
                    {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                    ))}
                </select>

                <select
                    value={eventType}
                    onChange={(e) => { setEventType(e.target.value); setResult(null); }}
                    style={selectStyle}
                >
                    {(providers.find((p) => p.id === provider)?.events || []).map((ev) => (
                        <option key={ev} value={ev}>{ev}</option>
                    ))}
                </select>

                <button
                    onClick={handleGenerate}
                    disabled={loading || !provider}
                    style={{ ...generateBtn, opacity: loading || !provider ? 0.5 : 1 }}
                >
                    {loading ? '⏳ Generating…' : '🎲 Generate'}
                </button>
            </div>

            {/* Payload preview + Send */}
            {payload && (
                <div>
                    <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>
                        {meta?.provider} → {meta?.eventType} — fresh payload:
                    </div>

                    <div style={{
                        background: '#09090b', border: '1px solid #27272a',
                        borderRadius: 8, padding: 10, maxHeight: 300,
                        overflow: 'auto', marginBottom: 12,
                    }}>
                        <ReactJson
                            src={payload}
                            theme="monokai"
                            collapsed={1}
                            displayDataTypes={false}
                            name={false}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleSend}
                            disabled={sending || !slug}
                            style={{
                                background: '#10b981', border: 'none', color: '#052e22',
                                fontWeight: 700, padding: '10px 20px', borderRadius: 8,
                                cursor: 'pointer', fontSize: 13,
                                opacity: sending || !slug ? 0.5 : 1,
                            }}
                        >
                            {sending ? '⏳ Sending…' : slug ? '🚀 Send to Endpoint' : '👆 Endpoint select karo'}
                        </button>

                        {result && (
                            <span style={{
                                fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                                background: result.ok ? '#10b98122' : '#ef444422',
                                color: result.ok ? '#10b981' : '#ef4444',
                            }}>
                                {result.ok
                                    ? `✅ Delivered! Status: ${result.status}`
                                    : `💥 Status: ${result.status || 'network fail'} — chaos ON hai kya? 😄`}
                            </span>
                        )}
                    </div>

                    {!slug && (
                        <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 8 }}>
                            ⚠️ Send ke liye pehle sidebar se koi endpoint select karo
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}