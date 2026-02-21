import { useState, useEffect } from 'react';
import { Search, Globe, Code, FolderOpen } from 'lucide-react';
import { ModalHeader, Field, ToolChip, AdvancedSection, useSessionToggle } from './NewBotModal';

const SIMPLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'gemini-2.0-flash', label: 'Gemini Flash' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
];

const FULL_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus' },
  { value: 'gemini-2.0-flash', label: 'Gemini Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini Pro' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
  { value: 'mistral-large-latest', label: 'Mistral Large' },
  { value: 'ollama/llama3.3', label: 'Ollama Llama 3.3 (local)' },
];

const SIMPLE_MODEL_VALUES = new Set(SIMPLE_MODELS.map(m => m.value));

const SIMPLE_SCHEDULES = [
  { label: 'Manual', value: '' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily 9:00', value: '0 9 * * *' },
  { label: 'Weekly Mon', value: '0 9 * * 1' },
];

const SIMPLE_SCHEDULE_VALUES = new Set(SIMPLE_SCHEDULES.map(s => s.value));

const TOOL_ICONS = {
  web_search: <Search size={14} strokeWidth={2} />,
  browser: <Globe size={14} strokeWidth={2} />,
  code: <Code size={14} strokeWidth={2} />,
  files: <FolderOpen size={14} strokeWidth={2} />,
};

const TOOLS = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'browser', label: 'Browser' },
  { value: 'code', label: 'Code' },
  { value: 'files', label: 'Files' },
];

const DEFAULT_MAX_RUNTIME = 120;

const hasAdvancedSettings = (bot) => {
  const schedule = bot.schedule || '';
  const model = bot.model || '';
  const tools = bot.tools || [];
  const maxRuntime = bot.max_runtime_seconds;
  const hasCustomSchedule = schedule && !SIMPLE_SCHEDULE_VALUES.has(schedule);
  const hasAdvancedModel = model && !SIMPLE_MODEL_VALUES.has(model);
  const hasAdvancedTools = tools.some(t => t !== 'web_search') || tools.length > 1;
  const hasCustomRuntime = typeof maxRuntime === 'number' && maxRuntime !== DEFAULT_MAX_RUNTIME;
  return hasCustomSchedule || hasAdvancedModel || hasAdvancedTools || hasCustomRuntime;
};

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
    max_runtime_seconds: bot.max_runtime_seconds || DEFAULT_MAX_RUNTIME,
  });
  const advancedDefaults = hasAdvancedSettings(bot);
  const [advancedOpen, setAdvancedOpen] = useSessionToggle('openclaw.editbot.advanced', advancedDefaults);

  useEffect(() => {
    if (advancedDefaults) setAdvancedOpen(true);
  }, [advancedDefaults, setAdvancedOpen]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const toggleTool = (t) => set('tools', form.tools.includes(t) ? form.tools.filter(x => x !== t) : [...form.tools, t]);
  const webSearchEnabled = form.tools.includes('web_search');

  const setWebSearch = (enabled) => {
    setForm(prev => {
      const hasWebSearch = prev.tools.includes('web_search');
      if (enabled && !hasWebSearch) return { ...prev, tools: [...prev.tools, 'web_search'] };
      if (!enabled && hasWebSearch) return { ...prev, tools: prev.tools.filter(t => t !== 'web_search') };
      return prev;
    });
  };

  const simpleModelOptions = SIMPLE_MODEL_VALUES.has(form.model)
    ? SIMPLE_MODELS
    : [...SIMPLE_MODELS, { value: form.model, label: `Advanced: ${form.model}` }];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card animate-scale" style={{ maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <ModalHeader title="Edit Bot" onClose={onClose} />
        <form onSubmit={e => { e.preventDefault(); if (form.name && form.prompt) onSave({ ...form, schedule: form.schedule || null }); }}
          className="space-y-5" style={{ marginTop: 20 }}>

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
              {simpleModelOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>

          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Search the web</span>
            <Toggle active={webSearchEnabled} onChange={() => setWebSearch(!webSearchEnabled)} />
          </div>

          <Field label="Schedule">
            <div className="flex flex-wrap gap-1.5">
              {SIMPLE_SCHEDULES.map(s => {
                const active = form.schedule === s.value;
                return (
                  <button key={s.value} type="button" onClick={() => set('schedule', s.value)} style={{
                    padding: '3px 10px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: 'all 0.15s ease',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                    color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}>{s.label}</button>
                );
              })}
            </div>
          </Field>

          <AdvancedSection open={advancedOpen} onToggle={() => setAdvancedOpen(open => !open)}>
            <div className="space-y-4">
              <Field label="Model (all)">
                <select value={form.model} onChange={e => set('model', e.target.value)} className="input-apple">
                  {FULL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>

              <Field label="Tools">
                <div className="flex flex-wrap gap-2">
                  {TOOLS.map(t => <ToolChip key={t.value} label={t.label} icon={TOOL_ICONS[t.value]} active={form.tools.includes(t.value)} onClick={() => toggleTool(t.value)} />)}
                </div>
              </Field>

              <Field label="Custom cron">
                <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
                  placeholder="*/30 * * * *" className="input-apple" style={{ fontFamily: 'SF Mono, Menlo, monospace' }} />
              </Field>

              <Field label="Max runtime (seconds)">
                <input type="number" value={form.max_runtime_seconds} onChange={e => set('max_runtime_seconds', parseInt(e.target.value, 10) || DEFAULT_MAX_RUNTIME)}
                  className="input-apple" min={10} max={600} />
              </Field>
            </div>
          </AdvancedSection>

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
