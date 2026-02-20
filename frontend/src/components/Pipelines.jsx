import { useState, useEffect } from 'react';
import { ArrowLeft, Link, Play, Trash2, Loader2, X, ArrowRight, Ban, SkipForward, RefreshCw } from 'lucide-react';
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
          <button onClick={onBack} className="btn-secondary" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} strokeWidth={1.5} /> Dashboard
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Pipeline</button>
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <p style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Link size={40} strokeWidth={1.5} />
          </p>
          <p style={{ fontSize: 15, fontWeight: 500 }}>No pipelines yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Connect bots into automated workflows</p>
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
    completed: { bg: 'rgba(52,199,89,0.1)', color: '#248A3D', label: 'Done' },
    failed: { bg: 'rgba(255,59,48,0.1)', color: '#D70015', label: 'Error' },
    running: { bg: 'rgba(255,149,0,0.1)', color: '#C93400', label: 'Running' },
  };
  const s = statusColors[pipeline.last_status] || { bg: 'rgba(142,142,147,0.1)', color: '#636366', label: 'Ready' };

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
            className="btn-primary" style={{ padding: '6px 14px', fontSize: 13, opacity: running ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            disabled={running}>
            {running ? <><Loader2 size={12} className="animate-spin" /> Running...</> : <><Play size={10} fill="white" strokeWidth={0} /> Run</>}
          </button>
          <button onClick={async () => { if(confirm('Delete pipeline?')) { await api.deletePipeline(pipeline.id); onRefresh(); }}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

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
              <ArrowRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>
        ))}
      </div>

      {pipeline.error_policy !== 'abort' && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          On error: {pipeline.error_policy === 'skip' ? 'Skip' : 'Retry'}
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
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>New Pipeline</h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
            border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={14} strokeWidth={1.5} /></button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Name</label>
            <input className="input-apple" value={name} onChange={e => setName(e.target.value)}
              placeholder="Newsletter-Workflow" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
            <input className="input-apple" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional..." />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Steps</label>
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 20 }}>{i + 1}.</span>
                <select className="input-apple" value={step.bot_id}
                  onChange={e => updateStep(i, 'bot_id', e.target.value)} style={{ flex: 1 }} required>
                  <option value="">Select bot...</option>
                  {bots.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
                </select>
                <select className="input-apple" value={step.input_mode}
                  onChange={e => updateStep(i, 'input_mode', e.target.value)} style={{ width: 160 }}>
                  <option value="forward">Forward output</option>
                  <option value="merge">Merge</option>
                  <option value="independent">Independent</option>
                </select>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                    display: 'flex', alignItems: 'center',
                  }}><X size={14} strokeWidth={1.5} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addStep} style={{
              fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0',
            }}>+ Add step</button>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>On error</label>
            <div className="flex gap-2">
              {[
                { v: 'abort', l: 'Abort', icon: <Ban size={14} strokeWidth={1.5} /> },
                { v: 'skip', l: 'Skip', icon: <SkipForward size={14} strokeWidth={1.5} /> },
                { v: 'retry', l: 'Retry', icon: <RefreshCw size={14} strokeWidth={1.5} /> },
              ].map(o => (
                <button key={o.v} type="button" onClick={() => setErrorPolicy(o.v)} style={{
                  padding: '6px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${errorPolicy === o.v ? 'rgba(0,122,255,0.3)' : 'var(--border)'}`,
                  background: errorPolicy === o.v ? 'rgba(0,122,255,0.08)' : 'transparent',
                  color: errorPolicy === o.v ? 'var(--accent)' : 'var(--text-secondary)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>{o.icon} {o.l}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3" style={{ paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px 18px' }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px 18px' }}>Create Pipeline</button>
          </div>
        </form>
      </div>
    </div>
  );
}
