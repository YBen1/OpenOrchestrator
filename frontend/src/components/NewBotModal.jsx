import { useState } from 'react';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'gemini-2.0-flash', label: 'Gemini Flash' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
];

const TOOLS = [
  { value: 'web_search', label: '🔍 Web Search' },
  { value: 'browser', label: '🌐 Browser' },
  { value: 'code', label: '💻 Code' },
  { value: 'files', label: '📁 Files' },
];

export default function NewBotModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', emoji: '🤖', prompt: '', model: 'gpt-4o-mini',
    tools: [], schedule: '', description: '',
  });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleTool = (t) => set('tools', form.tools.includes(t) ? form.tools.filter(x => x !== t) : [...form.tools, t]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card animate-scale" style={{ maxWidth: 480, padding: 28 }} onClick={e => e.stopPropagation()}>
        <ModalHeader title="New Bot" onClose={onClose} />
        <form onSubmit={e => { e.preventDefault(); if(form.name && form.prompt) onCreate({ ...form, description: form.description || form.prompt.slice(0,100), schedule: form.schedule || null }); }}
          className="space-y-5" style={{ marginTop: 20 }}>
          <div className="flex gap-3">
            <Field label="Emoji" style={{ width: 72 }}>
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className="input-apple" style={{ textAlign: 'center', fontSize: 20, padding: '8px' }} />
            </Field>
            <Field label="Name" style={{ flex: 1 }}>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="eBay-Scout" className="input-apple" required />
            </Field>
          </div>
          <Field label="Description">
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description..." className="input-apple" />
          </Field>
          <Field label="What should it do?">
            <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)} rows={3}
              placeholder="Search eBay for Nike Air Max under $50..." className="input-apple" required />
          </Field>
          <Field label="Model">
            <select value={form.model} onChange={e => set('model', e.target.value)} className="input-apple">
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Tools">
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(t => (
                <ToolChip key={t.value} label={t.label} active={form.tools.includes(t.value)} onClick={() => toggleTool(t.value)} />
              ))}
            </div>
          </Field>
          <Field label="Schedule (Cron, optional)">
            <input value={form.schedule} onChange={e => set('schedule', e.target.value)} placeholder="*/30 * * * *" className="input-apple" style={{ fontFamily: 'SF Mono, Menlo, monospace' }} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: 12 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: 12 }}>Create Bot</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
      <button onClick={onClose} className="btn-ghost" style={{ width: 28, height: 28, fontSize: 14, padding: 0 }}>✕</button>
    </div>
  );
}

export function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

export function ToolChip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
      border: '1px solid', transition: 'all 0.15s ease',
      background: active ? 'var(--accent-soft)' : 'var(--bg-tertiary)',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      color: active ? 'var(--accent)' : 'var(--text-secondary)',
    }}>{label}</button>
  );
}
