import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:5000');

function App() {
  const [webhooks, setWebhooks] = useState([]);
  const [slug, setSlug] = useState('hook-r3z6lqzsv');
  const [isConnected, setIsConnected] = useState(false);

  // 😈 CHAOS STATE
  const [chaos, setChaos] = useState({ enabled: false, delay: 0, errorStatus: null });

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('new-webhook', (data) => {
      setWebhooks((prev) => [data, ...prev]);
    });

    return () => {
      socket.off('connect');
      socket.off('new-webhook');
    };
  }, []);

  const joinRoom = () => {
    socket.emit('join-room', slug);
    loadChaosSettings();
  };

  // Chaos settings backend se load karo
  const loadChaosSettings = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/endpoints/${slug}`);
      setChaos(res.data.chaosConfig || { enabled: false, delay: 0, errorStatus: null });
    } catch (err) {
      console.log('Chaos settings load nahi hui:', err.message);
    }
  };

  // Chaos rules save karo
  const saveChaos = async () => {
    try {
      await axios.patch(`http://localhost:5000/api/endpoints/${slug}/chaos`, chaos);
      alert('😈 Chaos rules saved! Ab Postman se webhook bhejo!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-mono">
      {/* Header */}
      <div className="border-b border-gray-800 pb-6 mb-8">
        <h1 className="text-4xl font-bold text-blue-500">🚀 DevPulse</h1>
        <p className="text-gray-400 mt-2">Real-time Webhook Interceptor & Chaos Engine</p>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-sm text-gray-300">
          {isConnected ? 'Engine Connected (Live)' : 'Connecting...'}
        </span>
      </div>

      {/* Slug Input */}
      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="bg-gray-900 border border-gray-700 px-4 py-3 rounded-lg text-blue-400 flex-1 focus:outline-none focus:border-blue-500"
          placeholder="Enter your webhook slug..."
        />
        <button onClick={joinRoom} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">
          Listen
        </button>
      </div>

      {/* 😈 CHAOS ENGINE PANEL */}
      <div className={`mb-8 rounded-lg p-5 border transition-all ${chaos.enabled ? 'bg-red-950/40 border-red-600' : 'bg-gray-900 border-gray-800'
        }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold flex items-center gap-2 ${chaos.enabled ? 'text-red-400' : 'text-gray-300'}`}>
            😈 Chaos Engine
            {chaos.enabled && (
              <span className="text-xs bg-red-600 text-white px-2 py-1 rounded animate-pulse">ACTIVE!</span>
            )}
          </h3>

          {/* Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={chaos.enabled}
              onChange={(e) => setChaos({ ...chaos, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-red-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {chaos.enabled && (
          <div className="space-y-4">
            {/* ⏱️ Delay Slider */}
            <div>
              <label className="text-sm text-gray-300 flex justify-between mb-1">
                <span>⏱️ Delay Injection</span>
                <span className="text-yellow-400 font-bold">{(chaos.delay / 1000).toFixed(1)}s</span>
              </label>
              <input
                type="range"
                min="0" max="10000" step="500"
                value={chaos.delay}
                onChange={(e) => setChaos({ ...chaos, delay: Number(e.target.value) })}
                className="w-full accent-red-500"
              />
            </div>

            {/* 💥 Error Dropdown */}
            <div>
              <label className="text-sm text-gray-300 block mb-1">💥 Forced Error Status</label>
              <select
                value={chaos.errorStatus || ''}
                onChange={(e) => setChaos({ ...chaos, errorStatus: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-gray-900 border border-gray-700 px-3 py-2 rounded-lg text-white"
              >
                <option value="">None (Normal 200 OK)</option>
                <option value="500">500 — Internal Server Error</option>
                <option value="502">502 — Bad Gateway</option>
                <option value="504">504 — Gateway Timeout</option>
                <option value="429">429 — Too Many Requests</option>
              </select>
            </div>

            <button onClick={saveChaos} className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-bold transition-all">
              💾 Save Chaos Rules
            </button>
          </div>
        )}
      </div>

      {/* Webhooks List */}
      <h2 className="text-xl font-semibold mb-4 text-gray-200">Incoming Payloads ({webhooks.length})</h2>

      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-500">Koi webhook nahi aayi abhi tak...</p>
            <p className="text-gray-600 text-sm mt-2">Postman se request bhejo!</p>
          </div>
        ) : (
          webhooks.map((hook, index) => (
            <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-lg">
              <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
                <span className="text-xs font-bold text-green-400">POST 200 OK</span>
                <span className="text-xs text-gray-400">{new Date(hook.receivedAt).toLocaleTimeString()}</span>
              </div>
              <pre className="p-4 text-sm text-green-300 overflow-x-auto">
                {JSON.stringify(hook.body, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;