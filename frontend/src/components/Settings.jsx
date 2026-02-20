import { useState, useEffect } from 'react';
import { api } from '../api';

const PROVIDERS = [
  {
    id: 'openai', name: 'OpenAI', emoji: '✨', key: 'openai_api_key',
    models: 'GPT-5, GPT-4.1, o4-mini',
    cost: 'ab ~$5/Mo',
    signupUrl: 'https://platform.openai.com/signup',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic', name: 'Anthropic', emoji: '🟣', key: 'anthropic_api_key',
    models: 'Claude Sonnet, Haiku, Opus',
    cost: 'ab ~$5/Mo',
    signupUrl: 'https://console.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'google', name: 'Google Gemini', emoji: '🔵', key: 'google_api_key',
    models: 'Gemini 2.5 Pro, 2.0 Flash',
    cost: 'Gratis-Tier verfügbar',
    signupUrl: 'https://aistudio.google.com',
    keyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
  },
  {
    id: 'mistral', name: 'Mistral', emoji: '🟠', key: 'mistral_api_key',
    models: 'Mistral Large, Small',
    cost: 'ab ~$2/Mo',
    signupUrl: 'https://console.mistral.ai',
    keyUrl: 'https://console.mistral.ai/api-keys',
    placeholder: '...',
  },
  {
    id: 'ollama', name: 'Lokal (Ollama)', emoji: '🏠', key: 'ollama_base_url',
    models: 'Llama, Mistral, Phi lokal',
    cost: 'Kostenlos',
    signupUrl: 'https://ollama.com/download',
    keyUrl: null,
    placeholder: 'http://localhost:11434',
    isUrl: true,
  },
];

export default function Settings({ onBack }) {
  const [settings, setSettings] = useState({});
  const [usage, setUsage] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [inputs, setInputs] = useState({});
  const [tab, setTab] = useState('keys');

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getUsage().then(setUsage);
  }, []);

  const handleTest = async (provider) => {
    const p = PROVIDERS.find(x => x.id === provider);
    const value = inputs[p.key] || '';
    if (!value) return;
    setTesting(provider);
    setTestResult(prev => ({ ...prev, [provider]: null }));
    try {
      const res = await api.validateKey(provider, value);
      setTestResult(prev => ({ ...prev, [provider]: res }));
      if (res.valid) {
        await api.updateSettings({ [p.key]: value });
        setSettings(await api.getSettings());
      }
    } catch (e) {
      setTestResult(prev => ({ ...prev, [provider]: { valid: false, error: e.message } }));
    }
    setTesting(null);
  };

  const tabs = [
    { key: 'keys', label: '🔑 API-Keys', },
    { key: 'usage', label: '📊 Verbrauch', },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Einstellungen</h2>
        <button onClick={onBack} className="btn-secondary" style={{ fontSize: 13 }}>← Dashboard</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'inline-flex', background: 'rgba(0,0,0,0.04)',
        borderRadius: 12, padding: 3, gap: 2,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'white' : 'transparent',
            color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'keys' && (
        <div className="space-y-4">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Verbinde einen KI-Anbieter, damit deine Bots arbeiten können.
          </p>

          {PROVIDERS.map(p => {
            const isSet = settings[`${p.key}_set`] || (p.isUrl && settings[p.key]);
            const isExpanded = expanded === p.id;
            const result = testResult[p.id];

            return (
              <div key={p.id} className="glass-card" style={{ overflow: 'hidden' }}>
                <div
                  className="flex items-center gap-4 cursor-pointer"
                  style={{ padding: '16px 20px' }}
                  onClick={() => setExpanded(isExpanded ? null : p.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 28 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.models}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                      background: isSet ? 'rgba(52, 199, 89, 0.1)' : 'rgba(142, 142, 147, 0.1)',
                      color: isSet ? '#248A3D' : '#636366',
                    }}>
                      {isSet ? '✅ Verbunden' : '○ Nicht verbunden'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{p.cost}</div>
                  </div>
                  <span style={{
                    color: 'var(--text-tertiary)', fontSize: 10,
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>▼</span>
                </div>

                {isExpanded && (
                  <div className="animate-in" style={{
                    padding: '0 20px 20px', borderTop: '1px solid var(--divider)',
                  }}>
                    <div style={{ paddingTop: 16 }}>
                      {!p.isUrl && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                          <strong>Noch keinen Key?</strong>{' '}
                          <a href={p.signupUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            Account erstellen ↗
                          </a>
                          {' → '}
                          <a href={p.keyUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            API-Key erstellen ↗
                          </a>
                        </div>
                      )}
                      {p.isUrl && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                          <a href={p.signupUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            Ollama herunterladen ↗
                          </a>
                          {' — dann hier die URL eingeben:'}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type={p.isUrl ? 'url' : 'password'}
                          className="input-apple"
                          placeholder={p.placeholder}
                          value={inputs[p.key] || ''}
                          onChange={e => setInputs(prev => ({ ...prev, [p.key]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button
                          onClick={() => handleTest(p.id)}
                          className="btn-primary"
                          disabled={testing === p.id || !inputs[p.key]}
                          style={{ opacity: testing === p.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                          {testing === p.id ? '⏳ Teste...' : 'Testen & Speichern'}
                        </button>
                      </div>

                      {result && (
                        <div className="animate-in" style={{
                          marginTop: 12, padding: 12, borderRadius: 10, fontSize: 13,
                          background: result.valid ? 'rgba(52, 199, 89, 0.08)' : 'rgba(255, 59, 48, 0.08)',
                          color: result.valid ? '#248A3D' : '#D70015',
                        }}>
                          {result.valid ? (
                            <>
                              ✅ Verbindung erfolgreich!
                              {result.models?.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                  Verfügbare Modelle: {result.models.slice(0, 8).join(', ')}
                                  {result.models.length > 8 && ` +${result.models.length - 8} weitere`}
                                </div>
                              )}
                            </>
                          ) : (
                            <>❌ {result.error}</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'usage' && usage && (
        <div className="space-y-6">
          {/* Totals */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Runs gesamt', value: usage.total.runs, color: 'var(--accent)' },
              { label: 'Tokens rein', value: usage.total.tokens_in?.toLocaleString('de-DE') || '0', color: '#5856D6' },
              { label: 'Tokens raus', value: usage.total.tokens_out?.toLocaleString('de-DE') || '0', color: '#FF9500' },
              { label: 'Kosten', value: `$${usage.total.cost?.toFixed(2) || '0.00'}`, color: '#34C759' },
            ].map(s => (
              <div key={s.label} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per bot */}
          <div className="glass-card divide-y" style={{ borderColor: 'var(--divider)' }}>
            <div style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Pro Bot
            </div>
            {usage.per_bot.map(b => (
              <div key={b.bot_id} className="flex items-center gap-3" style={{ padding: '12px 20px', fontSize: 14 }}>
                <span>{b.bot_emoji}</span>
                <span style={{ fontWeight: 500, flex: 1 }}>{b.bot_name}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{b.runs} Runs</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {((b.tokens_in || 0) + (b.tokens_out || 0)).toLocaleString('de-DE')} Tokens
                </span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                  ${b.cost?.toFixed(4) || '0.00'}
                </span>
              </div>
            ))}
            {usage.per_bot.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                Noch keine Nutzung.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
