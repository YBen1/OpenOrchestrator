import { useState } from 'react';
import { api } from '../api';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', emoji: '✨', key: 'openai_api_key', placeholder: 'sk-...',
    url: 'https://platform.openai.com/api-keys', desc: 'GPT-5, GPT-4.1' },
  { id: 'anthropic', name: 'Anthropic', emoji: '🟣', key: 'anthropic_api_key', placeholder: 'sk-ant-...',
    url: 'https://console.anthropic.com/settings/keys', desc: 'Claude Sonnet, Opus' },
  { id: 'google', name: 'Google', emoji: '🔵', key: 'google_api_key', placeholder: 'AIza...',
    url: 'https://aistudio.google.com/apikey', desc: 'Gemini — Gratis-Tier!' },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const testAndSave = async () => {
    if (!provider || !keyInput) return;
    setTesting(true);
    setResult(null);
    const res = await api.validateKey(provider.id, keyInput);
    if (res.valid) {
      await api.updateSettings({ [provider.key]: keyInput });
      setResult(res);
      setTimeout(() => setStep(2), 1500);
    } else {
      setResult(res);
    }
    setTesting(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }}>
      <div className="animate-in" style={{ maxWidth: 500, width: '100%', padding: 32 }}>

        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚡</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
              Willkommen bei openOrchestrator
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              Erstelle KI-Bots die für dich arbeiten.<br/>
              Lass uns in 2 Minuten loslegen.
            </p>
            <button onClick={() => setStep(1)} className="btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
              Los geht's →
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
              🔑 KI-Anbieter verbinden
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Wähle einen Anbieter. Du brauchst einen API-Key — den bekommst du in 2 Minuten.
            </p>

            <div className="space-y-3" style={{ marginBottom: 24 }}>
              {PROVIDERS.map(p => (
                <div key={p.id} onClick={() => { setProvider(p); setResult(null); }}
                  className="card cursor-pointer hover-lift"
                  style={{
                    padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                    border: provider?.id === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  }}>
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.desc}</div>
                  </div>
                  {provider?.id === p.id && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </div>
              ))}
            </div>

            {provider && (
              <div className="animate-in">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <a href={provider.url} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                    Key erstellen bei {provider.name} ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input type="password" className="input-apple" placeholder={provider.placeholder}
                    value={keyInput} onChange={e => setKeyInput(e.target.value)} style={{ flex: 1 }} />
                  <button onClick={testAndSave} className="btn-primary" disabled={testing || !keyInput}
                    style={{ whiteSpace: 'nowrap', opacity: testing ? 0.6 : 1 }}>
                    {testing ? '⏳' : 'Testen'}
                  </button>
                </div>
                {result && (
                  <div className="animate-in" style={{
                    marginTop: 10, padding: 10, borderRadius: 10, fontSize: 13,
                    background: result.valid ? 'rgba(52,199,89,0.08)' : 'rgba(255,59,48,0.08)',
                    color: result.valid ? '#248A3D' : '#D70015',
                  }}>
                    {result.valid ? '✅ Verbunden!' : `❌ ${result.error}`}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setStep(2)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: 'var(--text-tertiary)',
              }}>Überspringen →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }} className="animate-in">
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Alles bereit!
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              {result?.valid ? 'Dein KI-Anbieter ist verbunden. ' : ''}
              Erstelle jetzt deinen ersten Bot oder wähle eine Vorlage.
            </p>
            <button onClick={onComplete} className="btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
              Dashboard öffnen →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
