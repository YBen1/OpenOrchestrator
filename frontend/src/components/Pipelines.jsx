import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Pipelines({ bots, onBack }) {
  const [pipelines, setPipelines] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => api.getPipelines().then(setPipelines);
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Pipelines</h2>
        <div className="flex gap-2">
          <button onClick={onBack} className="btn-secondary" style={{ fontSize: 13 }}>← Dashboard</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Neue Pipeline</button>
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔗</p>
          <p style={{ fontSize: 15, fontWeight: 500 }}>Noch keine Pipelines</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Verbinde Bots zu automatischen Workflows</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map(p => (
            <PipelineCard key={p.id} pipeline={p} bots={bots} onRefresh={load} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePipelineModal bots={bots} onClose={() => setShowCreate(false)}
          onCreate={async (data) => { await api.createPipeline(data); setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function PipelineCard({ pipeline, bots, onRefresh }) {
  const [running, setRunning] = useState(false);
  const statusColors = {
    completed: { bg: 'rgba(52,199,89,0.1)', color: '#248A3D', label: 'Fertig' },
    failed: { bg: 'rgba(255,59,48,0.1)', color: '#D70015', label: 'Fehler' },
    running: { bg: 'rgba(255,149,0,0.1)', color: '#C93400', label: 'Läuft' },
  };
  const s = statusColors[pipeline.last_status] || { bg: 'rgba(142,142,147,0.1)', color: '#636366', label: 'Bereit' };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{pipeline.name}</h3>
          {pipeline.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{pipeline.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          <button onClick={async () => { setRunning(true); await api.runPipeline(pipeline.id); setTimeout(() => { setRunning(false); onRefresh(); }, 2000); }}
            className="btn-primary" style={{ padding: '6px 14px', fontSize: 13, opacity: running ? 0.6 : 1 }}
            disabled={running}>
            {running ? '⏳ Läuft...' : '▶ Starten'}
          </button>
          <button onClick={async () => { if(confirm('Pipeline löschen?')) { await api.deletePipeline(pipeline.id); onRefresh(); }}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)' }}>
            🗑️
          </button>
        </div>
      </div>

      {/* Steps visualization */}
      <div className="flex items-center gap-2 flex-wrap">
        {pipeline.steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div style={{
              background: 'var(--bg)', borderRadius: 10, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
            }}>
              <span>{step.bot_emoji}</span>
              <span style={{ fontWeight: 500 }}>{step.bot_name}</span>
              {step.input_mode !== 'forward' && step.input_mode !== 'independent' && (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({step.input_mode})</span>
              )}
            </div>
            {i < pipeline.steps.length - 1 && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>→</span>
            )}
          </div>
        ))}
      </div>

      {pipeline.error_policy !== 'abort' && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          Bei Fehler: {pipeline.error_policy === 'skip' ? 'Überspringen' : 'Retry'}
        </div>
      )}
    </div>
  );
}

function CreatePipelineModal({ bots, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorPolicy, setErrorPolicy] = useState('abort');
  const [steps, setSteps] = useState([{ bot_id: '', input_mode: 'forward' }]);

  const addStep = () => setSteps([...steps, { bot_id: '', input_mode: 'forward' }]);
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i, field, value) => {
    const s = [...steps];
    s[i] = { ...s[i], [field]: value };
    setSteps(s);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name || steps.some(s => !s.bot_id)) return;
    onCreate({ name, description, error_policy: errorPolicy, steps });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 16,
    }} onClick={onClose}>
      <div className="card animate-in" style={{ width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Neue Pipeline</h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
            border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name</label>
            <input className="input-apple" value={name} onChange={e => setName(e.target.value)}
              placeholder="Newsletter-Workflow" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Beschreibung</label>
            <input className="input-apple" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional..." />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Schritte</label>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 20 }}>{i + 1}.</span>
                <select className="input-apple" value={step.bot_id}
                  onChange={e => updateStep(i, 'bot_id', e.target.value)} style={{ flex: 1 }} required>
                  <option value="">Bot wählen...</option>
                  {bots.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
                </select>
                <select className="input-apple" value={step.input_mode}
                  onChange={e => updateStep(i, 'input_mode', e.target.value)} style={{ width: 140 }}>
                  <option value="forward">➡️ Output übernehmen</option>
                  <option value="merge">🔀 Zusammenführen</option>
                  <option value="independent">🔹 Eigenständig</option>
                </select>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)',
                  }}>✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addStep} style={{
              fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0',
            }}>+ Schritt hinzufügen</button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Bei Fehler</label>
            <div className="flex gap-2">
              {[{ v: 'abort', l: '⛔ Abbrechen' }, { v: 'skip', l: '⏭️ Überspringen' }, { v: 'retry', l: '🔄 Retry' }].map(o => (
                <button key={o.v} type="button" onClick={() => setErrorPolicy(o.v)} style={{
                  padding: '6px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${errorPolicy === o.v ? 'rgba(0,122,255,0.3)' : 'var(--border)'}`,
                  background: errorPolicy === o.v ? 'rgba(0,122,255,0.08)' : 'transparent',
                  color: errorPolicy === o.v ? 'var(--accent)' : 'var(--text-secondary)',
                }}>{o.l}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3" style={{ paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px 18px' }}>Abbrechen</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px 18px' }}>Pipeline erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}
