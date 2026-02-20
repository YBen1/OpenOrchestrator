import { useState } from 'react';
import { ModalHeader, Field, ToolChip } from './NewBotModal';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }, { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' }, { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' }, { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku' }, { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus' },
  { value: 'gemini-2.0-flash', label: 'Gemini Flash' }, { value: 'gemini-2.5-pro', label: 'Gemini Pro' },
  { value: 'mistral-small-latest', label: 'Mistral Small' }, { value: 'mistral-large-latest', label: 'Mistral Large' },
];

const TOOLS = [
  { value: 'web_search', label: '🔍 Web Search' }, { value: 'browser', label: '🌐 Browser' },
  { value: 'code', label: '💻 Code' }, { value: 'files', label: '📁 Files' },
];

const SCHEDULES = [
  { label: 'Manual', value: '' }, { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' }, { label: 'Every 30 min', value: '*/30 * * * *' },
  { label: 'Hourly', value: '0 * * * *' }, { label: 'Every 6h', value: '0 */6 * * *' },
  { label: 'Daily 9:00', value: '0 9 * * *' }, { label: 'Mon 9:00', value: '0 9 * * 1' },
  { label: 'Custom...', value: 'custom' },
];

export default function EditBotModal({ bot, onClose, onSave }) {
  const [form, setForm] = useState({
    name: bot.name, emoji: bot.emoji, prompt: bot.prompt, model: bot.model,
    tools: bot.tools || [], schedule: bot.schedule || '', description: bot.description || '',
    enabled: bot.enabled !== false, max_runtime_seconds: bot.max_runtime_seconds || 120,
  });
  const [customCron, setCustomCron] = useState(!SCHEDULES.find(s => s.value === (bot.schedule || '')));

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleTool = (t) => set('tools', form.tools.includes(t) ? form.tools.filter(x => x !== t) : [...form.tools, t]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card animate-scale" style={{ maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <ModalHeader title="Edit Bot" onClose={onClose} />
        <form onSubmit={e => { e.preventDefault(); if(form.name && form.prompt) onSave({ ...form, schedule: form.schedule || null }); }}
          className="space-y-5" style={{ marginTop: 20 }}>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Bot active</span>
            <Toggle active={form.enabled} onChange={() => set('enabled', !form.enabled)} />
          </div>

          <div className="flex gap-3">
            <Field label="Emoji" style={{ width: 72 }}>
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)} className="input-apple" style={{ textAlign: 'center', fontSize: 20, padding: '8px' }} />
            </Field>
            <Field label="Name" style={{ flex: 1 }}>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input-apple" required />
            </Field>
          </div>

          <Field label="Description">
            <input value={form.description} onChange={e => set('description', e.target.value)} className="input-apple" />
          </Field>

          <Field label="What should it do?">
            <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)} rows={4} className="input-apple" required />
          </Field>

          <Field label="Model">
            <select value={form.model} onChange={e => set('model', e.target.value)} className="input-apple">
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>

          <Field label="Tools">
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(t => <ToolChip key={t.value} label={t.label} active={form.tools.includes(t.value)} onClick={() => toggleTool(t.value)} />)}
            </div>
          </Field>

          <Field label="Schedule">
            <div className="flex flex-wrap gap-1.5" style={{ marginBottom: customCron ? 8 : 0 }}>
              {SCHEDULES.map(s => (
                <button key={s.value} type="button" onClick={() => {
                  if (s.value === 'custom') { setCustomCron(true); } else { setCustomCron(false); set('schedule', s.value); }
                }} style={{
                  padding: '3px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid', transition: 'all 0.15s ease',
                  background: form.schedule === s.value ? 'var(--accent-soft)' : 'transparent',
                  borderColor: form.schedule === s.value ? 'var(--accent)' : 'var(--border)',
                  color: form.schedule === s.value ? 'var(--accent)' : 'var(--text-tertiary)',
                }}>{s.label}</button>
              ))}
            </div>
            {customCron && <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
              placeholder="*/30 * * * *" className="input-apple" style={{ fontFamily: 'SF Mono, Menlo, monospace' }} />}
          </Field>

          <Field label="Max runtime (seconds)">
            <input type="number" value={form.max_runtime_seconds} onChange={e => set('max_runtime_seconds', parseInt(e.target.value) || 120)}
              className="input-apple" min={10} max={600} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: 12 }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: 12 }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({ active, onChange }) {
  return (
    <button type="button" onClick={onChange} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
      background: active ? 'var(--success)' : 'var(--bg-tertiary)',
      transition: 'background 0.2s ease',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2,
        left: active ? 22 : 2, transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}
