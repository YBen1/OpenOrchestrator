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

  if (!bot) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 14 }}>Lade...</div>
    </div>
  );

  const stats = {
    runs: runs.length,
    results: results.length,
    success: runs.filter(r => r.status === 'completed').length,
    rate: runs.length ? Math.round(runs.filter(r => r.status === 'completed').length / runs.length * 100) : 0,
  };

  const tabs = [
    { key: 'results', label: 'Ergebnisse', icon: '📋' },
    { key: 'runs', label: 'Läufe', icon: '🔄' },
    { key: 'docs', label: 'Dokumente', icon: '📄' },
    { key: 'log', label: 'Live-Log', icon: '📊' },
  ];

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: 'var(--glass-shadow)', border: '1px solid var(--border)',
          }}>{bot.emoji}</div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{bot.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{bot.description || bot.prompt}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setLogs([]); await api.runBot(botId); load(); }} className="btn-primary">
            ▶ Jetzt starten
          </button>
          <button onClick={async () => { if(confirm('Bot löschen?')) { await api.deleteBot(botId); onRefresh(); onBack(); }}}
            style={{
              background: 'rgba(255, 59, 48, 0.08)', color: '#FF3B30',
              border: '1px solid rgba(255, 59, 48, 0.15)', borderRadius: 12,
              padding: '8px 14px', fontSize: 14, cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.08)'}
          >🗑️</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Läufe', value: stats.runs, color: 'var(--accent)' },
          { label: 'Ergebnisse', value: stats.results, color: '#5856D6' },
          { label: 'Intervall', value: bot.schedule || 'Manuell', color: '#FF9500' },
          { label: 'Erfolgsrate', value: `${stats.rate}%`, color: '#34C759' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs — Apple segmented control style */}
      <div style={{
        display: 'inline-flex', background: 'rgba(0,0,0,0.04)',
        borderRadius: 12, padding: 3, gap: 2,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'white' : 'transparent',
            color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in">
        {tab === 'results' && (
          <div className="glass-card divide-y" style={{ borderColor: 'var(--divider)' }}>
            {results.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                Noch keine Ergebnisse.
              </p>
            ) : results.map(r => (
              <div key={r.id} style={{ padding: 20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('de-DE') : ''}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'runs' && (
          <div className="glass-card divide-y" style={{ borderColor: 'var(--divider)' }}>
            {runs.length === 0 ? (
              <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                Noch keine Läufe.
              </p>
            ) : runs.map(r => (
              <div key={r.id} className="flex items-center gap-4" style={{ padding: '14px 20px', fontSize: 14 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: r.status === 'completed' ? '#34C759' : r.status === 'failed' ? '#FF3B30' : '#FF9500',
                  flexShrink: 0,
                }} className={r.status === 'running' ? 'pulse-dot' : ''} />
                <span style={{ width: 80, color: 'var(--text-secondary)', fontWeight: 500 }}>{r.status}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{r.trigger}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {r.started_at ? new Date(r.started_at).toLocaleString('de-DE') : ''}
                </span>
                {r.duration_ms != null && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{(r.duration_ms / 1000).toFixed(1)}s</span>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'docs' && (
          <div className="glass-card" style={{ padding: 20 }}>
            {docs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Keine Dokumente.</p>
            ) : docs.map(d => (
              <div key={d.name} className="flex items-center gap-2" style={{ padding: '6px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                📄 {d.name}
              </div>
            ))}
          </div>
        )}

        {tab === 'log' && (
          <div ref={logRef} style={{
            background: '#1C1C1E', borderRadius: 16, padding: 20,
            fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12,
            color: '#98989D', height: 320, overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {logs.length === 0 ? (
              <p style={{ color: '#48484A' }}>Starte einen Bot-Run um Live-Logs zu sehen...</p>
            ) : logs.map((line, i) => (
              <div key={i} style={{ padding: '2px 0' }}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
