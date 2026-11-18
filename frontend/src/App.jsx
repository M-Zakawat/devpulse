// ============================================================
// ⚡ DevPulse - Main Dashboard (App.jsx) — v4 FINAL FIXED
// Fix: Effects me ab official React async-fetch pattern hai
// (setState sirf await ke BAAD = koi cascading render warning nahi)
// Rule: States -> Refs -> Functions -> Effects -> UI
// ============================================================

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ReactJson from '@microlink/react-json-view';
import Analytics from './Analytics';

const API = 'http://localhost:5000';

// ---------- Helper Functions (module level) ----------

const statusColor = (code) => {
  if (code >= 200 && code < 300) return 'text-emerald-400';
  if (code >= 300 && code < 400) return 'text-sky-400';
  if (code >= 400 && code < 500) return 'text-amber-400';
  return 'text-red-400';
};

const methodBadge = (method) => {
  const map = {
    GET: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    POST: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    PUT: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    PATCH: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    DELETE: 'bg-red-500/15 text-red-300 border-red-500/40',
  };
  return map[method] || 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40';
};

const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour12: true });

export default function App() {
  // ================= 1) STATES =================
  const [endpoints, setEndpoints] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [socketOn, setSocketOn] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard' ya 'analytics'

  // Chaos states
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [chaosDelay, setChaosDelay] = useState('2000');
  const [chaosStatus, setChaosStatus] = useState('500');
  const [chaosSaved, setChaosSaved] = useState(false);

  // ================= 2) REFS =================
  const socketRef = useRef(null);
  const activeSlugRef = useRef(null);
  const prevSlugRef = useRef(null);

  // ================= 3) FUNCTIONS (event handlers) =================

  // Endpoint click: slug set + purani detail clear
  const selectEndpoint = (slug) => {
    setActiveSlug(slug);
    setSelectedLog(null);
  };

  // Naya endpoint banao
  const createEndpoint = async () => {
    if (!newName.trim()) {
      alert('Bhai pehle endpoint ka naam likho!');
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/api/endpoints`, {
        name: newName.trim(),
      });
      const ep = res.data.data || res.data;
      setEndpoints((prev) => [ep, ...prev]);
      setNewName('');
      setActiveSlug(ep.slug);
      setSelectedLog(null);
      console.log('✅ Endpoint ban gaya:', ep.slug);
    } catch (err) {
      console.error('❌ Create error:', err);
      alert('Endpoint create nahi hua! Backend chal raha hai? Check karo.');
    } finally {
      setCreating(false);
    }
  };

  // URL clipboard me copy karo
  const copyUrl = () => {
    navigator.clipboard.writeText(`${API}/hooks/${activeSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Chaos settings backend pe save karo
  const saveChaos = async () => {
    if (!activeSlug) return;
    try {
      await axios.put(`${API}/api/endpoints/${activeSlug}/chaos`, {
        chaosEnabled,
        delayMs: Number(chaosDelay) || 0,
        forcedStatus: Number(chaosStatus),
      });
      setChaosSaved(true);
      setTimeout(() => setChaosSaved(false), 2000);
      console.log('🔥 Chaos settings applied!');
    } catch (err) {
      console.error('❌ Chaos save error:', err);
      alert('Chaos save nahi hui! Backend route check karo.');
    }
  };

  // Client-side logs clear
  const clearLogs = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  // ================= 4) EFFECTS =================

  // activeSlug change -> ref update (ref likhna effect me allowed hai)
  useEffect(() => {
    activeSlugRef.current = activeSlug;
  }, [activeSlug]);

  // App load: endpoints laao + Socket.io setup
  useEffect(() => {
    // OFFICIAL PATTERN: async IIFE, setState sirf await ke BAAD
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/endpoints`);
        if (!cancelled) setEndpoints(res.data.data || res.data);
      } catch (err) {
        console.error('❌ Endpoints load nahi hue:', err.message);
      }
    })();

    const socket = io(API);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket.io CONNECTED! ID:', socket.id);
      setSocketOn(true);
      if (activeSlugRef.current) socket.emit('join-room', activeSlugRef.current);
    });
    socket.on('disconnect', () => setSocketOn(false));

    // Real-time listener: sirf ACTIVE endpoint ka log dikhao
    socket.on('new-webhook', (log) => {
      console.log('📡 Naya webhook aaya:', log);
      if (log.slug && log.slug !== activeSlugRef.current) return;
      setLogs((prev) => [log, ...prev]);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  // Endpoint switch: room swap + logs laao
  useEffect(() => {
    if (!activeSlug) return;

    if (prevSlugRef.current && prevSlugRef.current !== activeSlug) {
      socketRef.current?.emit('leave-room', prevSlugRef.current);
    }
    prevSlugRef.current = activeSlug;
    socketRef.current?.emit('join-room', activeSlug);

    // OFFICIAL PATTERN: cancelled flag se race condition bhi safe
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/endpoints/${activeSlug}/logs`);
        if (!cancelled) setLogs(res.data.data || res.data);
      } catch (err) {
        console.error('❌ Logs load nahi hue:', err.message);
        if (!cancelled) setLogs([]);
      }
    })();

    return () => { cancelled = true; };
  }, [activeSlug]);

  // ================= 5) UI =================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col">

      {/* ===== HEADER ===== */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Dev<span className="text-emerald-400">Pulse</span>
            </h1>
            <p className="text-xs text-zinc-500">Webhook Mocking & Chaos Testing Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1 bg-zinc-800/60 rounded-lg p-1">
            <button
              onClick={() => setView('dashboard')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'dashboard' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'analytics' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              📊 Analytics
            </button>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${socketOn ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-zinc-400">{socketOn ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ===== SIDEBAR ===== */}
        <aside className="w-72 border-r border-zinc-800 flex flex-col">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Endpoints</h2>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createEndpoint()}
                placeholder="e.g. Stripe Payments"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={createEndpoint}
                disabled={creating}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-lg px-3 py-2 text-sm"
              >
                {creating ? '...' : '+'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            {endpoints.length === 0 && (
              <p className="text-xs text-zinc-600 mt-4 text-center">
                Koi endpoint nahi.<br />Pehla endpoint banao 👆
              </p>
            )}
            {endpoints.map((ep) => (
              <button
                key={ep.slug}
                onClick={() => selectEndpoint(ep.slug)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${activeSlug === ep.slug
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-zinc-900/50 border-transparent hover:bg-zinc-800/60'
                  }`}
              >
                <p className="text-sm font-medium text-zinc-200 truncate">{ep.name}</p>
                <p className="text-xs text-zinc-500 font-mono">/{ep.slug}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* ===== MAIN AREA ===== */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {view === 'analytics' ? (
            // --- ANALYTICS VIEW ---
            <Analytics slug={activeSlug} />
          ) : !activeSlug ? (
            // --- WELCOME SCREEN ---
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-6xl mb-4">🪝</span>
              <h2 className="text-2xl font-bold text-zinc-300">Welcome to DevPulse</h2>
              <p className="text-zinc-500 mt-2 max-w-md">
                Left side se endpoint select karo ya naya banao. Phir uska URL copy karke
                kisi bhi service (Stripe, GitHub, Shopify) se webhook fire karo —
                logs yahan REAL-TIME aayenge!
              </p>
            </div>
          ) : (
            <>
              {/* --- URL BAR --- */}
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Your Webhook URL</h3>
                  <span className="text-xs font-mono text-zinc-500">/{activeSlug}</span>
                </div>
                <div className="flex gap-2">
                  <code className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-emerald-300 font-mono overflow-x-auto whitespace-nowrap">
                    {API}/hooks/{activeSlug}
                  </code>
                  <button onClick={copyUrl} className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-medium">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a href={`${API}/hooks/${activeSlug}`} target="_blank" rel="noreferrer"
                    className="bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 rounded-lg px-4 py-2.5 text-sm font-medium">
                    Test (GET)
                  </a>
                </div>
              </section>

              {/* --- CHAOS PANEL --- */}
              <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chaos Testing</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className={`text-sm font-medium ${chaosEnabled ? 'text-red-400' : 'text-zinc-500'}`}>
                      {chaosEnabled ? '🔥 CHAOS ON' : 'Chaos Off'}
                    </span>
                    <input type="checkbox" checked={chaosEnabled} onChange={(e) => setChaosEnabled(e.target.checked)} className="hidden" />
                    <span className={`w-10 h-5 rounded-full transition ${chaosEnabled ? 'bg-red-500' : 'bg-zinc-700'} relative`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${chaosEnabled ? 'left-5' : 'left-0.5'}`} />
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 block mb-1">Delay (ms)</label>
                    <input type="number" value={chaosDelay} onChange={(e) => setChaosDelay(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 block mb-1">Force Status</label>
                    <select value={chaosStatus} onChange={(e) => setChaosStatus(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-red-500">
                      <option value="500">500 - Server Error</option>
                      <option value="502">502 - Bad Gateway</option>
                      <option value="504">504 - Gateway Timeout</option>
                      <option value="429">429 - Too Many Requests</option>
                    </select>
                  </div>
                  <button onClick={saveChaos}
                    className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 rounded-lg px-4 py-2 text-sm font-medium">
                    {chaosSaved ? 'Saved!' : 'Apply Chaos'}
                  </button>
                </div>
                {chaosEnabled && (
                  <p className="text-xs text-red-400/80 mt-2">
                    ⚠️ Ab har incoming webhook pe {chaosDelay}ms delay lagega, uske baad {chaosStatus} status force hoga!
                  </p>
                )}
              </section>

              {/* --- WEBHOOK LOGS --- */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Webhook Logs {logs.length > 0 && <span className="text-emerald-400">({logs.length})</span>}
                  </h3>
                  <button onClick={clearLogs} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
                </div>

                {logs.length === 0 ? (
                  <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-10 text-center">
                    <p className="text-zinc-500 text-sm">Abhi koi webhook nahi aaya.</p>
                    <p className="text-zinc-600 text-xs mt-1">
                      Upar URL copy karo aur browser ya curl se hit karo — log foran yahan live aayega!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, i) => (
                      <button key={log._id || i} onClick={() => setSelectedLog(log)}
                        className={`w-full text-left bg-zinc-900 border rounded-xl px-4 py-3 flex items-center gap-4 transition ${selectedLog === log ? 'border-emerald-500/50' : 'border-zinc-800 hover:border-zinc-700'
                          }`}>
                        <span className={`px-2 py-0.5 rounded border text-xs font-bold font-mono ${methodBadge((log.method || '').toUpperCase())}`}>
                          {(log.method || '?').toUpperCase()}
                        </span>
                        <span className={`text-sm font-bold font-mono ${statusColor(log.statusCode ?? log.status)}`}>
                          {log.statusCode ?? log.status ?? '?'}
                        </span>
                        <span className="text-sm text-zinc-400 font-mono truncate flex-1">
                          {log.path || '/'}
                        </span>
                        {log.chaosApplied && (
                          <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">CHAOS</span>
                        )}
                        <span className="text-xs text-zinc-600">{formatTime(log.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* --- LOG DETAIL (X-RAY JSON VIEWER) --- */}
              {selectedLog && (
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">X-Ray View (Full Payload)</h3>
                    <button onClick={() => setSelectedLog(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">✕</button>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-x-auto max-h-96">
                    <ReactJson
                      src={selectedLog}
                      name={null}
                      theme="monokai"
                      collapsed={1}
                      displayDataTypes={false}
                      enableClipboard
                      style={{ backgroundColor: 'transparent', fontSize: '13px' }}
                    />
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}