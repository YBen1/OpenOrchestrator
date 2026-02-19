import { useState, useEffect, useRef } from 'react';
import { api, connectWs } from '../api';

export default function BotDetail({ botId, onBack, onRefresh }) {
  const [bot, setBot] = useState(null);
  const [runs, setRuns] = useState([]);
  const [results, setResults] = useState([]);
  const [docs, setDocs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('results');
  const logRef = useRef(null);

  const load = async () => {
    const [b, r, res, d] = await Promise.all([
      api.getBot(botId), api.listRuns(botId), api.listResults(botId), api.listDocs(botId),
    ]);
    setBot(b); setRuns(r); setResults(res); setDocs(d);
  };

  useEffect(() => { load(); }, [botId]);

  useEffect(() => {
    const ws = connectWs(botId, (msg) => {
      if (msg.type === 'log') setLogs(prev => [...prev, msg.line]);
      if (msg.type === 'run_complete') load();
    });
    return () => ws.close();
  }, [botId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  if (!bot) return <div className="text-gray-500">Lade...</div>;

  const stats = {
    runs: runs.length,
    results: results.length,
    success: runs.filter(r => r.status === 'completed').length,
    rate: runs.length ? Math.round(runs.filter(r => r.status === 'completed').length / runs.length * 100) : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{bot.emoji}</span>
          <div>
            <h2 className="text-xl font-bold">{bot.name}</h2>
            <p className="text-sm text-gray-400">{bot.description || bot.prompt}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setLogs([]); await api.runBot(botId); load(); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            ▶️ Jetzt starten
          </button>
          <button onClick={async () => { if(confirm('Bot löschen?')) { await api.deleteBot(botId); onRefresh(); onBack(); }}}
            className="bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-2 rounded-lg text-sm transition">
            🗑️
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Läufe', value: stats.runs },
          { label: 'Ergebnisse', value: stats.results },
          { label: 'Intervall', value: bot.schedule || 'Manuell' },
          { label: 'Erfolg', value: `${stats.rate}%` },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
        {['results', 'runs', 'docs', 'log'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm transition ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'results' ? '📋 Ergebnisse' : t === 'runs' ? '🔄 Läufe' : t === 'docs' ? '📄 Dokumente' : '📊 Log'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'results' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {results.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">Noch keine Ergebnisse.</p>
          ) : results.map(r => (
            <div key={r.id} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{r.title}</span>
                <span className="text-xs text-gray-500">
                  {r.created_at ? new Date(r.created_at).toLocaleString('de-DE') : ''}
                </span>
              </div>
              <p className="text-sm text-gray-400 whitespace-pre-wrap">{r.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'runs' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {runs.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">Noch keine Läufe.</p>
          ) : runs.map(r => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-4 text-sm">
              <span className={`w-2 h-2 rounded-full ${r.status === 'completed' ? 'bg-green-400' : r.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-gray-500 w-20">{r.status}</span>
              <span className="text-gray-500">{r.trigger}</span>
              <span className="flex-1" />
              <span className="text-gray-600 text-xs">
                {r.started_at ? new Date(r.started_at).toLocaleString('de-DE') : ''}
              </span>
              {r.duration_ms != null && <span className="text-gray-600 text-xs">{(r.duration_ms / 1000).toFixed(1)}s</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'docs' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          {docs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center">Keine Dokumente.</p>
          ) : docs.map(d => (
            <div key={d.name} className="flex items-center gap-2 py-1 text-sm text-gray-300">
              <span>📄</span> {d.name}
            </div>
          ))}
        </div>
      )}

      {tab === 'log' && (
        <div ref={logRef} className="bg-gray-950 rounded-xl border border-gray-800 p-4 font-mono text-xs text-gray-300 h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-600">Starte einen Bot-Run um Live-Logs zu sehen...</p>
          ) : logs.map((line, i) => (
            <div key={i} className="py-0.5">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
