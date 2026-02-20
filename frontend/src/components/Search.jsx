import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function SearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = (q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(q);
        setResults(res);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 50, paddingTop: 80,
    }} onClick={onClose}>
      <div className="glass-card animate-in" style={{ width: '100%', maxWidth: 600, maxHeight: '70vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* Search input */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); doSearch(e.target.value); }}
            placeholder="Ergebnisse durchsuchen..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 16, color: 'var(--text-primary)',
            }}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {loading && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>⏳</span>}
          <kbd style={{
            fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg)',
            padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 'calc(70vh - 60px)', overflowY: 'auto' }}>
          {results.length === 0 && query.length >= 2 && !loading && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
              Keine Ergebnisse für "{query}"
            </div>
          )}
          {results.map(r => (
            <div key={r.id}
              className="cursor-pointer"
              style={{ padding: '12px 20px', borderBottom: '1px solid var(--divider)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelect(r.bot_id); onClose(); }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                <span>{r.bot_emoji}</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{r.bot_name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {r.started_at ? new Date(r.started_at).toLocaleString('de-DE') : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {r.preview}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
