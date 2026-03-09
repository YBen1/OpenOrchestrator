import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pencil, Download, BarChart3, Trash2, RefreshCw, FileText, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, connectWs } from '../api';

function formatSize(bytes) {
  if (bytes < 1024) {return bytes + ' B';}
  if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function DocsTab({ botId }) {
    const [expandedDoc, setExpandedDoc] = useState(null);
  const [docContent, setDocContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const loadDocs = async () => {
    const res = await fetch(`/api/bots/${botId}/docs`);
    if (res.ok) {setDocs(await res.json());}
  };

  useEffect(() => { loadDocs(); }, [botId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) {return;}
    if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5 MB)'); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/bots/${botId}/docs`, { method: 'POST', body: fd });
      if (!res.ok) {throw new Error(await res.text());}
      await loadDocs();
    } catch (err) { alert('Upload failed: ' + err.message); }
    setUploading(false);
    if (fileRef.current) {fileRef.current.value = '';}
  };

  const handleDelete = async (name) => {
    if (!confirm(`Delete "${name}"?`)) {return;}
    await fetch(`/api/bots/${botId}/docs/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (expandedDoc === name) { setExpandedDoc(null); setDocContent(''); }
    await loadDocs();
  };

  const toggleContent = async (name) => {
    if (expandedDoc === name) { setExpandedDoc(null); setDocContent(''); return; }
    const res = await fetch(`/api/bots/${botId}/docs/${encodeURIComponent(name)}`);
    if (res.ok) { setDocContent(await res.text()); setExpandedDoc(name); }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{docs.length} Document{docs.length !== 1 ? 's' : ''}</span>
        <div>
          <input type="file" ref={fileRef} onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} className="btn-primary" disabled={uploading}
            style={{ fontSize: 13, padding: '6px 14px' }}>
            {uploading ? 'Uploading...' : '+ Upload Document'}
          </button>
        </div>
      </div>
      {docs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: 20 }}>No documents yet. Upload one to get started.</p>
      ) : (
        <div>
          {docs.map(d => (
            <div key={d.name}>
              <div className="flex items-center gap-3" style={{
                padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14,
              }}>
                <FileText size={14} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
                <button onClick={() => toggleContent(d.name)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)',
                  fontWeight: 500, textAlign: 'left', padding: 0, fontSize: 14,
                }}>{d.name}</button>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatSize(d.size_bytes)}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {d.modified_at ? new Date(d.modified_at).toLocaleString() : ''}
                </span>
                <span style={{ flex: 1 }} />
                <button onClick={() => handleDelete(d.name)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
                  padding: '2px 6px', fontSize: 16, lineHeight: 1,
                }} title="Delete">×</button>
              </div>
              {expandedDoc === d.name && (
                <pre style={{
                  background: 'var(--bg-secondary)', padding: 12, borderRadius: 8,
                  fontSize: 12, overflow: 'auto', maxHeight: 400, margin: '8px 0 12px',
                  border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{docContent}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BotDetail({ botId, onBack, onRefresh, onEdit }) {
  const [bot, setBot] = useState(null);
  const [runs, setRuns] = useState([]);
  const [results, setResults] = useState([]);
    const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('results');
  const logRef = useRef(null);

  const load = async () => {
    const [b, r, res] = await Promise.all([
      api.getBot(botId), api.listRuns(botId), api.listResults(botId),
    ]);
    setBot(b); setRuns(r); setResults(res);
  };

  useEffect(() => { load(); }, [botId]);
  useEffect(() => {
    const ws = connectWs(botId, (msg) => {
      if (msg.type === 'log') {setLogs(prev => [...prev, msg.line]);}
      if (msg.type === 'run_complete') {load();}
    });
    return () => ws.close();
  }, [botId]);
  useEffect(() => { if (logRef.current) {logRef.current.scrollTop = logRef.current.scrollHeight;} }, [logs]);

  if (!bot) {return <div className="empty-state"><div className="empty-title">Loading...</div></div>;}

  const stats = {
    runs: runs.length,
    results: results.length,
    success: runs.filter(r => r.status === 'completed').length,
    rate: runs.length ? Math.round(runs.filter(r => r.status === 'completed').length / runs.length * 100) : 0,
  };

  const tabs = [
    { key: 'results', label: 'Results', icon: <Copy size={15} strokeWidth={1.5} /> },
    { key: 'runs', label: 'Runs', icon: <RefreshCw size={15} strokeWidth={1.5} /> },
    { key: 'docs', label: 'Documents', icon: <FileText size={15} strokeWidth={1.5} /> },
    { key: 'log', label: 'Live Log', icon: <BarChart3 size={15} strokeWidth={1.5} /> },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34 }}>
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: 'var(--accent)',
            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
          }}>{(bot.name || '?')[0].toUpperCase()}</div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{bot.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{bot.description || bot.prompt}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setLogs([]); await api.runBot(botId); load(); }} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Play size={12} fill="white" strokeWidth={0} /> Run
          </button>
          {onEdit && <button onClick={() => onEdit(bot)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={14} strokeWidth={1.5} /> Edit
          </button>}
          <button onClick={async () => {
            const data = await api.exportBot(botId);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: `${bot.name}.json` }).click();
          }} className="btn-ghost" title="Export bot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34 }}>
            <Download size={16} strokeWidth={1.5} />
          </button>
          <a href={api.exportCsv(botId)} className="btn-ghost" title="Export CSV" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34 }}>
            <BarChart3 size={16} strokeWidth={1.5} />
          </a>
          <button onClick={async () => { if(confirm('Delete bot?')) { await api.deleteBot(botId); onRefresh(); onBack(); }}}
            className="btn-ghost" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34 }}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Runs', value: stats.runs, color: 'var(--accent)' },
          { label: 'Results', value: stats.results, color: 'var(--purple)' },
          { label: 'Schedule', value: bot.schedule || 'Manual', color: 'var(--warning)' },
          { label: 'Success Rate', value: `${stats.rate}%`, color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="segmented-control">
        {tabs.map(t => (
          <button key={t.key} data-active={tab === t.key} onClick={() => setTab(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="animate-in">
        {tab === 'results' && (
          <div className="card divide-styled">
            {results.length === 0 ? (
              <div className="empty-state"><p className="empty-title">No results yet.</p></div>
            ) : results.map(r => (
              <div key={r.id} style={{ padding: 20 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('en-US') : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }} className="markdown-content">
                  <ReactMarkdown components={{ a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }} /> }}>{r.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'runs' && (
          <div className="card divide-styled">
            {runs.length === 0 ? (
              <div className="empty-state"><p className="empty-title">No runs yet.</p></div>
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
                  {r.started_at ? new Date(r.started_at).toLocaleString('en-US') : ''}
                </span>
                {r.duration_ms != null && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{(r.duration_ms / 1000).toFixed(1)}s</span>}
              </div>
            ))}
          </div>
        )}

        {tab === 'docs' && (
          <DocsTab botId={botId} />
        )}

        {tab === 'log' && (
          <div ref={logRef} className="log-output" style={{ height: 320 }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-quaternary)' }}>Start a bot run to see live logs...</p>
            ) : logs.map((line, i) => <div key={i} style={{ padding: '1px 0' }}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
