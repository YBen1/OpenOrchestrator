import { useState } from 'react';

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
  { value: 'mistral-large-latest', label: 'Mistral Large' },
];

const TOOLS = [
  { value: 'web_search', label: '🔍 Web-Suche' },
  { value: 'browser', label: '🌐 Browser' },
  { value: 'code', label: '💻 Code' },
  { value: 'files', label: '📁 Dateien' },
];

const SCHEDULE_PRESETS = [
  { label: 'Manuell', value: '' },
  { label: 'Alle 5 Minuten', value: '*/5 * * * *' },
  { label: 'Alle 15 Minuten', value: '*/15 * * * *' },
  { label: 'Alle 30 Minuten', value: '*/30 * * * *' },
  { label: 'Jede Stunde', value: '0 * * * *' },
  { label: 'Alle 6 Stunden', value: '0 */6 * * *' },
  { label: 'Täglich 9:00', value: '0 9 * * *' },
  { label: 'Montags 9:00', value: '0 9 * * 1' },
  { label: 'Eigene Cron...', value: 'custom' },
];

export default function EditBotModal({ bot, onClose, onSave }) {
  const [form, setForm] = useState({
    name: bot.name,
    emoji: bot.emoji,
    prompt: bot.prompt,
    model: bot.model,
    tools: bot.tools || [],
    schedule: bot.schedule || '',
    description: bot.description || '',
    enabled: bot.enabled !== false,
    max_runtime_seconds: bot.max_runtime_seconds || 120,
  });
  const [scheduleMode, setScheduleMode] = useState(
    SCHEDULE_PRESETS.find(p => p.value === (bot.schedule || '')) ? 'preset' : 'custom'
  );

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleTool = (t) => set('tools', form.tools.includes(t) ? form.tools.filter(x => x !== t) : [...form.tools, t]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.prompt) return;
    onSave({
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
      <div className="glass-card animate-in" style={{ width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Bot bearbeiten</h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <Label>Bot aktiv</Label>
            <button type="button" onClick={() => set('enabled', !form.enabled)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: form.enabled ? '#34C759' : 'rgba(0,0,0,0.1)',
              position: 'relative', transition: 'background 0.2s ease',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 2,
                left: form.enabled ? 22 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
          </div>

          <div className="flex gap-3">
            <div style={{ width: 72 }}>
              <Label>Emoji</Label>
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)}
                className="input-apple" style={{ textAlign: 'center', fontSize: 20, padding: '8px 10px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Name</Label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="input-apple" required />
            </div>
          </div>

          <div>
            <Label>Beschreibung</Label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              className="input-apple" />
          </div>

          <div>
            <Label>Was soll er tun?</Label>
            <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)} rows={4}
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
            <Label>Zeitplan</Label>
            <div className="flex flex-wrap gap-2" style={{ marginBottom: 8 }}>
              {SCHEDULE_PRESETS.map(p => (
                <button key={p.value} type="button" onClick={() => {
                  if (p.value === 'custom') {
                    setScheduleMode('custom');
                  } else {
                    setScheduleMode('preset');
                    set('schedule', p.value);
                  }
                }} style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid',
                  background: form.schedule === p.value ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
                  borderColor: form.schedule === p.value ? 'rgba(0, 122, 255, 0.3)' : 'var(--border)',
                  color: form.schedule === p.value ? 'var(--accent)' : 'var(--text-tertiary)',
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            {scheduleMode === 'custom' && (
              <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
                placeholder="*/30 * * * *" className="input-apple"
                style={{ fontFamily: 'SF Mono, Menlo, monospace' }} />
            )}
          </div>

          <div>
            <Label>Max. Laufzeit (Sekunden)</Label>
            <input type="number" value={form.max_runtime_seconds}
              onChange={e => set('max_runtime_seconds', parseInt(e.target.value) || 120)}
              className="input-apple" min={10} max={600} />
          </div>

          <div className="flex gap-3" style={{ paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px 18px' }}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px 18px' }}>
              Speichern
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
