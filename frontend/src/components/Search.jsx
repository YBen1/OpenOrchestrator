import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function SearchModal({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = (q) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await api.search(q)); } catch { setResults([]); }
      setLoading(false);
    }, 250);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 50, paddingTop: '12vh',
    }} onClick={onClose}>
      <div className="modal-card animate-scale" style={{ maxWidth: 560, maxHeight: '65vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, color: 'var(--text-tertiary)', flexShrink: 0 }}>🔍</span>
          <input ref={inputRef} value={query}
            onChange={e => { setQuery(e.target.value); doSearch(e.target.value); }}
            placeholder="Search results..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-primary)', fontFamily: 'inherit' }}
            onKeyDown={e => e.key === 'Escape' && onClose()} />
          {loading && <span className="animate-spin" style={{ fontSize: 14 }}>⏳</span>}
          <kbd style={{ fontSize: 11, color: 'var(--text-quaternary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: 'calc(65vh - 50px)', overflowY: 'auto' }}>
          {results.length === 0 && query.length >= 2 && !loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>No results for "{query}"</div>
          )}
          {results.map(r => (
            <div key={r.id} className="cursor-pointer" style={{ padding: '12px 18px', borderBottom: '1px solid var(--divider)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelect(r.bot_id); onClose(); }}>
              <div className="flex items-center gap-2 mb-1">
                <span>{r.bot_emoji}</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{r.bot_name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {r.started_at ? new Date(r.started_at).toLocaleString('en-US') : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.preview}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
