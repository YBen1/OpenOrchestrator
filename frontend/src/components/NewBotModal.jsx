import { useState } from 'react';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku' },
];

const TOOLS = [
  { value: 'web_search', label: '🔍 Web-Suche' },
  { value: 'browser', label: '🌐 Browser' },
  { value: 'code', label: '💻 Code' },
  { value: 'files', label: '📁 Dateien' },
];

export default function NewBotModal({ bots, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', emoji: '🤖', prompt: '', model: 'gpt-4o-mini',
    tools: [], schedule: '', description: '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleTool = (t) => set('tools', form.tools.includes(t) ? form.tools.filter(x => x !== t) : [...form.tools, t]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.prompt) return;
    onCreate({
      ...form,
      description: form.description || form.prompt.slice(0, 100),
      schedule: form.schedule || null,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div className="glass-card animate-in" style={{ width: '100%', maxWidth: 480, padding: 28 }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Neuer Bot</h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="flex gap-3">
            <div style={{ width: 72 }}>
              <Label>Emoji</Label>
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)}
                className="input-apple" style={{ textAlign: 'center', fontSize: 20, padding: '8px 10px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Name</Label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="eBay-Scout"
                className="input-apple" required />
            </div>
          </div>

          <div>
            <Label>Beschreibung</Label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Kurze Beschreibung..." className="input-apple" />
          </div>

          <div>
            <Label>Was soll er tun?</Label>
            <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)} rows={3}
              placeholder="Suche auf eBay Kleinanzeigen nach Nike Air Max unter 50€..."
              className="input-apple" style={{ resize: 'none' }} required />
          </div>

          <div>
            <Label>Model</Label>
            <select value={form.model} onChange={e => set('model', e.target.value)} className="input-apple">
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <Label>Tools</Label>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(t => (
                <button key={t.value} type="button" onClick={() => toggleTool(t.value)} style={{
                  padding: '6px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid',
                  background: form.tools.includes(t.value) ? 'rgba(0, 122, 255, 0.08)' : 'var(--bg)',
                  borderColor: form.tools.includes(t.value) ? 'rgba(0, 122, 255, 0.3)' : 'var(--border)',
                  color: form.tools.includes(t.value) ? 'var(--accent)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Zeitplan (Cron, optional)</Label>
            <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
              placeholder="*/30 * * * *"
              className="input-apple" style={{ fontFamily: 'SF Mono, Menlo, monospace' }} />
          </div>

          <div className="flex gap-3" style={{ paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px 18px' }}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px 18px' }}>
              Bot anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
      {children}
    </label>
  );
}
