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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Neuer Bot</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="text-xs text-gray-500 block mb-1">Emoji</label>
              <input value={form.emoji} onChange={e => set('emoji', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-center text-xl" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="eBay-Scout"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" required />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Kurze Beschreibung..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Was soll er tun?</label>
            <textarea value={form.prompt} onChange={e => set('prompt', e.target.value)} rows={3}
              placeholder="Suche auf eBay Kleinanzeigen nach Nike Air Max unter 50€..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none" required />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Model</label>
            <select value={form.model} onChange={e => set('model', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Tools</label>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(t => (
                <button key={t.value} type="button" onClick={() => toggleTool(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${form.tools.includes(t.value) ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Zeitplan (Cron, optional)</label>
            <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
              placeholder="*/30 * * * *"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm transition">
              Abbrechen
            </button>
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-sm font-medium transition">
              Bot anlegen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
