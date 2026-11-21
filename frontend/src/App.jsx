// frontend/src/App.jsx — v6 FINAL (Sprint 5)
// Dashboard + Chaos + Live Logs + Analytics + 🧠 Smart Payload Generator
// Fixes: {data:[...]} shape handle, nested chaos config sync, empty-name feedback
// Golden ordering: States → Refs → Functions → Effects → UI

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ReactJson from '@microlink/react-json-view';
import Analytics from './Analytics';
import SmartPayload from './SmartPayload';

const API = 'http://localhost:5000';

// ── UI helpers (component ke bahar — har render pe dubara na banein) ──
const METHOD_CLASS = {
  GET: 'bg-sky-500/15 text-sky-400',
  POST: 'bg-emerald-500/15 text-emerald-400',
  PUT: 'bg-amber-500/15 text-amber-400',
  PATCH: 'bg-purple-500/15 text-purple-400',
  DELETE: 'bg-red-500/15 text-red-400',
};

const statusColor = (code) => {
  if (code >= 200 && code < 300) return 'bg-emerald-500/15 text-emerald-400';
  if (code >= 300 && code < 400) return 'bg-sky-500/15 text-sky-400';
  if (code >= 400 && code < 500) return 'bg-amber-500/15 text-amber-400';
  return 'bg-red-500/15 text-red-400';
};

const CHAOS_STATUSES = [200, 204, 400, 401, 403, 404, 429, 500, 502, 503, 504];

// ── Response parse helpers (backend ki har shape handle karte hain) ──
// Backend kabhi [array] bhejta hai, kabhi {data: [...]}, kabhi {endpoints: [...]}
const pickArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.endpoints)) return data.endpoints;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.result)) return data.result;
  return [];
};

const pickOne = (data) => data?.endpoint || data?.data || data?.result || data || null;

export default function App() {
  // ═══ 1) STATES ═══
  const [view, setView] = useState('dashboard');
  const [endpoints, setEndpoints] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [chaosDelay, setChaosDelay] = useState(2000);
  const [chaosStatus, setChaosStatus] = useState(500);
  const [chaosMsg, setChaosMsg] = useState('');

  // ═══ 2) REFS ═══
  const socketRef = useRef(null);
  const activeSlugRef = useRef('');
  const prevSlugRef = useRef('');

  // ═══ 3) FUNCTIONS ═══

  // Sare endpoints lao — jo shape backend bheje, sab handle
  const loadEndpoints = async () => {
    try {
      const res = await fetch(`${API}/api/endpoints`);
      const data = await res.json();
      const arr = pickArray(data);
      setEndpoints(arr);
      return arr;
    } catch (err) {
      console.error('❌ Endpoints load fail:', err.message);
      return [];
    }
  };

  // Logs lao — selected endpoint ke
  const loadLogs = async (slug) => {
    if (!slug) return;
    try {
      const res = await fetch(`${API}/api/endpoints/${slug}/logs`);
      const data = await res.json();
      setLogs(pickArray(data));
    } catch (err) {
      console.error('❌ Logs load fail:', err.message);
    }
  };

  // Endpoint select — purane room se jao, naye me shamil ho jao
  const selectEndpoint = (slug, ep) => {
    if (!slug) return;
    if (slug === activeSlugRef.current) {
      loadLogs(slug); // same endpoint — bas logs refresh
      return;
    }
    if (prevSlugRef.current && socketRef.current) {
      socketRef.current.emit('leave-room', prevSlugRef.current);
    }
    if (socketRef.current) socketRef.current.emit('join-room', slug);
    prevSlugRef.current = slug;
    activeSlugRef.current = slug;
    setActiveSlug(slug);
    setSelectedLog(null);
    loadLogs(slug);
    // Chaos panel ko endpoint ke saved config se sync karo
    // Backend me config NESTED hai: chaos: {enabled, delayMs, forcedStatus}
    // (purana chaosConfig bhi padh lete hain — safe side)
    if (ep) {
      const ch = ep.chaos || ep.chaosConfig || {};
      setChaosEnabled(Boolean(ch.enabled));
      setChaosDelay(ch.delayMs ?? ch.delay ?? 2000);
      setChaosStatus(ch.forcedStatus ?? ch.errorStatus ?? 500);
    }
  };

  // Naya endpoint banao
  const createEndpoint = async () => {
    const name = newName.trim();
    if (!name) {
      alert('Pehle endpoint ka naam likho 😄 (e.g. Payment Service)');
      return;
    }
    try {
      const res = await fetch(`${API}/api/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || 'Endpoint ban nahi saka — backend terminal check karo');
        return;
      }
      setNewName('');
      await loadEndpoints();
      const ep = pickOne(data);
      if (ep?.slug) selectEndpoint(ep.slug, ep);
    } catch (err) {
      console.error('❌ Create fail:', err.message);
      alert('Backend tak request nahi pohanchi — server chal raha hai?');
    }
  };

  // URL copy
  const copyUrl = async () => {
    if (!activeSlug) return;
    try {
      await navigator.clipboard.writeText(`${API}/hooks/${activeSlug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('❌ Copy fail:', err.message);
    }
  };

  // Test GET — khud ek GET fire karo, log socket se aayegi
  const testGet = async () => {
    if (!activeSlug) return;
    try {
      await fetch(`${API}/hooks/${activeSlug}`);
    } catch (err) {
      console.error('❌ Test GET fail:', err.message);
    }
  };

  // Chaos apply — PUT request
  // Backend ka route jo bhi shape padhta hai, sab de rahe hain (flat + nested)
  const applyChaos = async () => {
    if (!activeSlug) return;
    const delayMs = Number(chaosDelay) || 0;
    const status = Number(chaosStatus) || 500;
    try {
      const res = await fetch(`${API}/api/endpoints/${activeSlug}/chaos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // flat namings
          enabled: chaosEnabled,
          delayMs,
          status,
          forcedStatus: status,
          delay: delayMs,
          errorStatus: status,
          // nested namings
          chaos: { enabled: chaosEnabled, delayMs, forcedStatus: status },
          chaosConfig: { enabled: chaosEnabled, delay: delayMs, errorStatus: status },
        }),
      });
      if (res.ok) {
        setChaosMsg(
          chaosEnabled
            ? `🌪️ Chaos applied: ${delayMs}ms delay + ${status} force status`
            : '✅ Chaos OFF — sab normal'
        );
        setTimeout(() => setChaosMsg(''), 4000);
        loadEndpoints(); // sidebar refresh — saved config wapis sync
      } else {
        setChaosMsg('⚠️ Chaos apply fail — backend check karo');
        setTimeout(() => setChaosMsg(''), 4000);
      }
    } catch (err) {
      console.error('❌ Chaos fail:', err.message);
    }
  };

  // ═══ 4) EFFECTS ═══

  // Socket — ek dafa connect, room filter ke sath live logs
  useEffect(() => {
    const socket = io(API);
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('new-webhook', (log) => {
      if (log.slug && log.slug !== activeSlugRef.current) return;
      setLogs((prev) => [log, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  // Pehli load — endpoints lao, pehla auto-select karo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const arr = await loadEndpoints();
      if (!cancelled && arr.length > 0 && !activeSlugRef.current) {
        selectEndpoint(arr[0].slug, arr[0]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ═══ 5) UI ═══
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">⚡ DevPulse</h1>
          <p className="text-[11px] text-zinc-500">Webhook Mocking & Chaos Testing Engine</p>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1 bg-zinc-800/60 rounded-lg p-1">
            <button
              onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 rounded-md text-sm transition ${view === 'dashboard' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-3 py-1.5 rounded-md text-sm transition ${view === 'analytics' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              📊 Analytics
            </button>
          </nav>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-zinc-400">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* ═══ DASHBOARD VIEW ═══ */}
      {view === 'dashboard' && (
        <div className="flex h-[calc(100vh-57px)]">
          {/* Sidebar */}
          <aside className="w-72 shrink-0 border-r border-zinc-800 p-4 overflow-y-auto flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-2">Endpoints</h2>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createEndpoint()}
                  placeholder="e.g. Payment Service"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-600"
                />
                <button
                  onClick={createEndpoint}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                >
                  + Create
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {endpoints.map((ep) => (
                <button
                  key={ep.slug}
                  onClick={() => selectEndpoint(ep.slug, ep)}
                  className={`text-left p-3 rounded-lg border transition ${ep.slug === activeSlug
                      ? 'border-emerald-600 bg-emerald-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                >
                  <div className="text-sm font-medium">{ep.name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">/{ep.slug}</div>
                </button>
              ))}
              {endpoints.length === 0 && (
                <p className="text-xs text-zinc-600">Abhi koi endpoint nahi — pehla banao! 👆</p>
              )}
            </div>
          </aside>

          {/* Main area */}
          <main className="flex-1 overflow-y-auto p-5 space-y-4">
            {!activeSlug ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                👈 Sidebar se endpoint select karo ya naya banao
              </div>
            ) : (
              <>
                {/* URL bar */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-[11px] text-zinc-500 mb-2">
                    Webhook URL — isko copy karke provider (GitHub/Stripe/Shopify) me paste karo
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 truncate">
                      {API}/hooks/{activeSlug}
                    </code>
                    <button
                      onClick={copyUrl}
                      className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm shrink-0"
                    >
                      {copied ? '✅ Copied' : '📋 Copy'}
                    </button>
                    <button
                      onClick={testGet}
                      className="bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-sm shrink-0"
                    >
                      🧪 Test GET
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-2">
                    💡 Provider ko dena ho to ngrok wala public URL use karo: https://TERA-NGROK.ngrok-free.app/hooks/{activeSlug}
                  </div>
                </div>

                {/* Chaos panel */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">🌪️ Chaos Engineering</h3>
                    <button
                      onClick={() => setChaosEnabled(!chaosEnabled)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border transition ${chaosEnabled
                          ? 'bg-amber-500/20 text-amber-400 border-amber-600/50'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                    >
                      {chaosEnabled ? '🌪️ ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-zinc-500">Delay (ms)</label>
                    <input
                      type="number"
                      value={chaosDelay}
                      onChange={(e) => setChaosDelay(e.target.value)}
                      className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm outline-none"
                    />
                    <label className="text-xs text-zinc-500 ml-2">Force Status</label>
                    <select
                      value={chaosStatus}
                      onChange={(e) => setChaosStatus(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm outline-none"
                    >
                      {CHAOS_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={applyChaos}
                      className="ml-auto bg-amber-600 hover:bg-amber-500 text-black font-bold px-4 py-1.5 rounded-lg text-sm"
                    >
                      ⚡ Apply
                    </button>
                  </div>
                  {chaosEnabled && (
                    <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      ⚠️ Ab har incoming webhook pe {chaosDelay}ms delay lagega, uske baad {chaosStatus} status force hoga!
                    </div>
                  )}
                  {chaosMsg && <div className="mt-2 text-xs text-emerald-400">{chaosMsg}</div>}
                </div>

                {/* 🧠 Sprint 5 — Smart Payload (Chaos ke neeche, logs se pehle) */}
                <SmartPayload slug={activeSlug} />

                {/* Live logs */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">⚡ Webhook Logs ({logs.length})</h3>
                    <button
                      onClick={() => { setLogs([]); setSelectedLog(null); }}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <button
                        key={log._id}
                        onClick={() => setSelectedLog(log)}
                        className="w-full flex items-center gap-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-lg px-3 py-2 text-left transition"
                      >
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${METHOD_CLASS[log.method] || 'bg-zinc-700 text-zinc-300'}`}>
                          {log.method}
                        </span>
                        <span className="font-mono text-xs text-zinc-400 flex-1 truncate">/hooks/{log.slug}</span>
                        {log.chaosApplied && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">CHAOS</span>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor(log.statusCode)}`}>
                          {log.statusCode}
                        </span>
                        <span className="text-[10px] text-zinc-600 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </button>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-xs text-zinc-600 py-4 text-center">
                        Abhi koi traffic nahi — Smart Payload se webhook fire karo 🚀
                      </p>
                    )}
                  </div>
                </div>

                {/* X-Ray */}
                {selectedLog && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">🔍 X-Ray View — Full Payload</h3>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-80 overflow-auto">
                      <ReactJson src={selectedLog} theme="monokai" collapsed={1} displayDataTypes={false} />
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* ═══ ANALYTICS VIEW ═══ */}
      {view === 'analytics' && (
        <main className="h-[calc(100vh-57px)] overflow-y-auto">
          <Analytics slug={activeSlug} />
        </main>
      )}
    </div>
  );
}