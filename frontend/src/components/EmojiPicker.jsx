import { useState } from 'react';
import { X, Search } from 'lucide-react';

const CATEGORIES = [
  { name: 'Emotions', emojis: ['happy','smirk','laughing','surprised','sleepy','crying','cool','angry','love','angel','devil','party','starry','pizza','music','sick'] },
  { name: 'Characters', emojis: ['wizard','cowboy','ninja','pirate','gamer','money','robot','fire','ghost'] },
  { name: 'Activities', emojis: ['laptop','writing','sports','cooking-phone','camera-lens','reading','camera','painting','chef','frying','weightlifting','gardening','gaming','delivery','sleeping','fishing','lazy','shopping','packing','meditating'] },
  { name: 'Tech/Work', emojis: ['web-scraper','spider','download','cloud-upload','video-search','search','editor','calendar','database','rocket','settings-gear','blocks','tag-camera','package','pipeline','satellite','unbox','cubes-small','sync','apps-colorful','apps-letters','apps-green','email','code-terminal','doc-search','doc-check','numbers','target-orange','clipboard','smile-small','alert','sync-green','backup','hourglass','database-group'] },
];

export default function EmojiPicker({ value, onChange, onClose }) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 12, width: 380, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search emojis..."
            autoFocus
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13,
            }}
          />
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 2,
          }}><X size={14} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 10px 10px' }}>
          {CATEGORIES.map(cat => {
            const filtered = cat.emojis.filter(e => !q || e.includes(q));
            if (filtered.length === 0) {return null;}
            return (
              <div key={cat.name}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  padding: '8px 4px 4px',
                }}>{cat.name}</div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
                }}>
                  {filtered.map(emoji => (
                    <button key={emoji} onClick={() => { onChange(emoji); onClose(); }}
                      title={emoji}
                      style={{
                        width: 48, height: 48, padding: 4,
                        background: value === emoji ? 'var(--accent-soft)' : 'transparent',
                        border: value === emoji ? '2px solid var(--accent)' : '2px solid transparent',
                        borderRadius: 10, cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onMouseEnter={e => {
                        if (value !== emoji) {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (value !== emoji) {
                          e.currentTarget.style.background = 'transparent';
                        }
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <img src={`/emojis/${emoji}.png`} alt={emoji}
                        style={{ width: 36, height: 36, objectFit: 'contain' }} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
