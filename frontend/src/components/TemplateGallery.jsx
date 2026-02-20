import { useState, useEffect } from 'react';
import { api } from '../api';

export default function TemplateGallery({ onClose, onCreate }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getTemplates().then(setTemplates);
  }, []);

  const categories = [...new Set(templates.map(t => t.category))];

  const handleUse = (tmpl) => {
    onCreate({
      name: tmpl.name,
      emoji: tmpl.emoji,
      description: tmpl.description,
      prompt: tmpl.prompt,
      model: tmpl.model,
      tools: tmpl.tools,
      schedule: tmpl.schedule,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div className="glass-card animate-in" style={{
        width: '100%', maxWidth: 680, padding: 28, maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Bot-Vorlagen</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Wähle eine Vorlage und passe sie an
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {cat}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {templates.filter(t => t.category === cat).map(tmpl => (
                <div key={tmpl.id}
                  className="hover-lift cursor-pointer"
                  style={{
                    background: selected === tmpl.id ? 'rgba(0, 122, 255, 0.04)' : 'var(--bg)',
                    border: `1px solid ${selected === tmpl.id ? 'rgba(0, 122, 255, 0.3)' : 'var(--border)'}`,
                    borderRadius: 14, padding: 16,
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setSelected(selected === tmpl.id ? null : tmpl.id)}
                >
                  <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{tmpl.emoji}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{tmpl.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {tmpl.model} {tmpl.schedule ? `· ⏰ ${tmpl.schedule}` : ''}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: selected === tmpl.id ? 12 : 0 }}>
                    {tmpl.description}
                  </p>

                  {selected === tmpl.id && (
                    <div className="animate-in">
                      <div style={{
                        background: 'white', borderRadius: 10, padding: 12, marginBottom: 12,
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                        fontFamily: 'SF Mono, Menlo, monospace', whiteSpace: 'pre-wrap',
                      }}>
                        {tmpl.prompt}
                      </div>
                      <div className="flex gap-2">
                        {tmpl.tools.map(t => (
                          <span key={t} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 6,
                            background: 'rgba(0,122,255,0.08)', color: 'var(--accent)',
                          }}>
                            {t === 'web_search' ? '🔍 Web' : t === 'files' ? '📁 Dateien' : t}
                          </span>
                        ))}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleUse(tmpl); }}
                        className="btn-primary" style={{ marginTop: 12, width: '100%', padding: '10px 18px' }}>
                        Vorlage verwenden
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
