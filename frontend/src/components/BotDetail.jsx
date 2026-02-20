import { useState, useEffect, useRef } from 'react';
import { api, connectWs } from '../api';

export default function BotDetail({ botId, onBack, onRefresh, onEdit }) {
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
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  if (!bot) return <div className="empty-state"><div className="empty-title">Lade...</div></div>;

  const stats = {
    runs: runs.length,
    results: results.length,
    success: runs.filter(r => r.status === 'completed').length,
    rate: runs.length ? Math.round(runs.filter(r => r.status === 'completed').length / runs.length * 100) : 0,
  };

  const tabs = [
    { key: 'results', label: '📋 Ergebnisse' },
    { key: 'runs', label: '🔄 Läufe' },
    { key: 'docs', label: '📄 Dokumente' },
    { key: 'log', label: '📊 Live-Log' },
  ];

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost" style={{ fontSize: 16 }}>←</button>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>{bot.emoji}</div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{bot.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{bot.description || bot.prompt}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setLogs([]); await api.runBot(botId); load(); }} className="btn-primary">▶ Starten</button>
          {onEdit && <button onClick={() => onEdit(bot)} className="btn-secondary">✏️ Bearbeiten</button>}
          <button onClick={async () => {
            const data = await api.exportBot(botId);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: `${bot.name}.json` }).click();
          }} className="btn-ghost" title="Bot exportieren">📥</button>
          <a href={api.exportCsv(botId)} className="btn-ghost" title="CSV exportieren" style={{ textDecoration: 'none' }}>📊</a>
          <button onClick={async () => { if(confirm('Bot löschen?')) { await api.deleteBot(botId); onRefresh(); onBack(); }}}
            className="btn-ghost" style={{ color: 'var(--danger)' }}>🗑️</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Läufe', value: stats.runs, color: 'var(--accent)' },
          { label: 'Ergebnisse', value: stats.results, color: 'var(--purple)' },
          { label: 'Intervall', value: bot.schedule || 'Manuell', color: 'var(--warning)' },
          { label: 'Erfolgsrate', value: `${stats.rate}%`, color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="segmented-control">
        {tabs.map(t => (
          <button key={t.key} data-active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-in">
        {tab === 'results' && (
          <div className="card divide-styled">
            {results.length === 0 ? (
              <div className="empty-state"><p className="empty-title">Noch keine Ergebnisse.</p></div>
            ) : results.map(r => (
              <div key={r.id} style={{ padding: 20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('de-DE') : ''}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{r.content}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'runs' && (
          <div className="card divide-styled">
            {runs.length === 0 ? (
              <div className="empty-state"><p className="empty-title">Noch keine Läufe.</p></div>
            ) : runs.map(r => (
              <div key={r.id} className="flex items-center gap-4" style={{ padding: '12px 20px', fontSize: 14 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: r.status === 'completed' ? 'var(--success)' : r.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                }} className={r.status === 'running' ? 'pulse-dot' : ''} />
                <span style={{ width: 80, color: 'var(--text-secondary)', fontWeight: 500 }}>{r.status}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{r.trigger}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {r.started_at ? new Date(r.started_at).toLocaleString('de-DE') : ''}
                </span>
                {r.duration_ms != null && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{(r.duration_ms / 1000).toFixed(1)}s</span>}
              </div>
            ))}
          </div>
        )}

        {tab === 'docs' && (
          <div className="card" style={{ padding: 20 }}>
            {docs.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>Keine Dokumente.</p>
            ) : docs.map(d => (
              <div key={d.name} className="flex items-center gap-2" style={{ padding: '6px 0', fontSize: 14, color: 'var(--text-secondary)' }}>📄 {d.name}</div>
            ))}
          </div>
        )}

        {tab === 'log' && (
          <div ref={logRef} className="log-output" style={{ height: 320 }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-quaternary)' }}>Starte einen Bot-Run um Live-Logs zu sehen...</p>
            ) : logs.map((line, i) => <div key={i} style={{ padding: '1px 0' }}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
