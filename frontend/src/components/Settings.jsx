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
    cost: 'Free tier available',
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
    id: 'brave', name: 'Brave Search', emoji: '🔍', key: 'brave_api_key',
    models: 'Web search for bots',
    cost: '2000 searches/mo free',
    signupUrl: 'https://brave.com/search/api/',
    keyUrl: 'https://api.search.brave.com/app/keys',
    placeholder: 'BSA...',
  },
  {
    id: 'ollama', name: 'Lokal (Ollama)', emoji: '🏠', key: 'ollama_base_url',
    models: 'Llama, Mistral, Phi local',
    cost: 'Costlos',
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
  const [system, setSystem] = useState(null);
  const [channels, setChannels] = useState([]);
  const [tgToken, setTgToken] = useState('');
  const [tgChat, setTgChat] = useState(null);
  const [tgSearching, setTgSearching] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getUsage().then(setUsage);
    api.getChannels().then(setChannels);
    api.getSystem().then(setSystem);
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

  const findTgChat = async () => {
    if (!tgToken) return;
    setTgSearching(true);
    try {
      const chat = await api.findTelegramChat(tgToken);
      setTgChat(chat);
    } catch {
      setTgChat({ error: true });
    }
    setTgSearching(false);
  };

  const addTelegramChannel = async () => {
    if (!tgToken || !tgChat?.chat_id) return;
    await api.createChannel({ type: 'telegram', name: `Telegram: ${tgChat.name}`, config: { bot_token: tgToken, chat_id: tgChat.chat_id } });
    setChannels(await api.getChannels());
    setTgToken(''); setTgChat(null);
  };

  const addWebhook = async () => {
    if (!webhookUrl) return;
    await api.createChannel({ type: 'webhook', name: 'Webhook', config: { url: webhookUrl } });
    setChannels(await api.getChannels());
    setWebhookUrl('');
  };

  const tabs = [
    { key: 'keys', label: '🔑 API Keys' },
    { key: 'channels', label: '📱 Channels' },
    { key: 'usage', label: '📊 Usage' },
    { key: 'system', label: 'ℹ️ System' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h2>
        <button onClick={onBack} className="btn-secondary" style={{ fontSize: 13 }}>← Dashboard</button>
      </div>

      <div className="segmented-control">
        {tabs.map(t => (
          <button key={t.key} data-active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'keys' && (
        <div className="space-y-4">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Connect an AI provider so your bots can work.
          </p>

          {PROVIDERS.map(p => {
            const isSet = settings[`${p.key}_set`] || (p.isUrl && settings[p.key]);
            const isExpanded = expanded === p.id;
            const result = testResult[p.id];

            return (
              <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
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
                      {isSet ? '✅ Connected' : '○ Not connected'}
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
                          <strong>No key yet?</strong>{' '}
                          <a href={p.signupUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            Create account ↗
                          </a>
                          {' → '}
                          <a href={p.keyUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            Create API key ↗
                          </a>
                        </div>
                      )}
                      {p.isUrl && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                          <a href={p.signupUrl} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>
                            Download Ollama ↗
                          </a>
                          {' — then enter the URL here:'}
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
                          {testing === p.id ? '⏳ Testing...' : 'Test & Save'}
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
                              ✅ Connection successful!
                              {result.models?.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                  Available models: {result.models.slice(0, 8).join(', ')}
                                  {result.models.length > 8 && ` +${result.models.length - 8} more`}
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

      {tab === 'channels' && (
        <div className="space-y-6">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Get bot results via Telegram, webhook, or email.
          </p>

          {/* Existing channels */}
          {channels.length > 0 && (
            <div className="card divide-y" style={{ borderColor: 'var(--divider)' }}>
              {channels.map(ch => (
                <div key={ch.id} className="flex items-center gap-4" style={{ padding: '14px 20px' }}>
                  <span style={{ fontSize: 22 }}>{ch.type === 'telegram' ? '📱' : ch.type === 'webhook' ? '🪝' : '📧'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{ch.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ch.type}</div>
                  </div>
                  <span className="status-pill" style={{
                    background: ch.status === 'connected' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                    color: ch.status === 'connected' ? '#248A3D' : '#D70015',
                  }}>
                    {ch.status === 'connected' ? '✅ Connected' : '❌ Error'}
                  </span>
                  <button onClick={async () => {
                    await api.deleteChannel(ch.id);
                    setChannels(await api.getChannels());
                  }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                    color: 'var(--text-tertiary)', padding: 4,
                  }}>🗑️</button>
                </div>
              ))}
            </div>
          )}

          {/* Add Telegram — Guided Wizard */}
          <TelegramWizard onConnected={async () => setChannels(await api.getChannels())} />

          {/* Add Webhook */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🪝 Add Webhook</h3>
            <div className="flex gap-2">
              <input className="input-apple" placeholder="https://example.com/webhook" value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)} style={{ flex: 1 }} />
              <button onClick={addWebhook} className="btn-primary" disabled={!webhookUrl}
                style={{ whiteSpace: 'nowrap' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'usage' && usage && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total runs', value: usage.total.runs, color: 'var(--accent)' },
              { label: 'Tokens in', value: usage.total.tokens_in?.toLocaleString('en-US') || '0', color: 'var(--purple)' },
              { label: 'Tokens out', value: usage.total.tokens_out?.toLocaleString('en-US') || '0', color: 'var(--warning)' },
              { label: 'Cost', value: `$${usage.total.cost?.toFixed(2) || '0.00'}`, color: 'var(--success)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per bot */}
          <div className="card divide-y" style={{ borderColor: 'var(--divider)' }}>
            <div style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Per Bot
            </div>
            {usage.per_bot.map(b => (
              <div key={b.bot_id} className="flex items-center gap-3" style={{ padding: '12px 20px', fontSize: 14 }}>
                <span>{b.bot_emoji}</span>
                <span style={{ fontWeight: 500, flex: 1 }}>{b.bot_name}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{b.runs} Runs</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {((b.tokens_in || 0) + (b.tokens_out || 0)).toLocaleString('en-US')} Tokens
                </span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                  ${b.cost?.toFixed(4) || '0.00'}
                </span>
              </div>
            ))}
            {usage.per_bot.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                No usage yet.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'system' && system && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Version', value: system.version, color: 'var(--accent)' },
              { label: 'Bots', value: system.bots, color: '#5856D6' },
              { label: 'Runs', value: system.runs, color: '#FF9500' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>System Status</h3>
            <div className="space-y-3" style={{ fontSize: 14 }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Database</span>
                <span style={{ fontWeight: 500 }}>{system.db_size_mb} MB</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Pipelines</span>
                <span style={{ fontWeight: 500 }}>{system.pipelines}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Scheduler</span>
                <span style={{ fontWeight: 500, color: '#248A3D' }}>
                  {system.scheduler_running ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Connected providers</span>
                <span style={{ fontWeight: 500 }}>
                  {system.providers_connected?.length > 0
                    ? system.providers_connected.join(', ')
                    : 'None'}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Keyboard shortcuts</h3>
            <div className="space-y-2" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {[
                ['⌘/Ctrl + K', 'Open search'],
                ['⌘/Ctrl + N', 'New bot'],
                ['⌘/Ctrl + ,', 'Settings'],
                ['ESC', 'Close modal'],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between">
                  <span>{desc}</span>
                  <kbd style={{
                    fontSize: 11, background: 'var(--bg)', padding: '2px 8px',
                    borderRadius: 4, border: '1px solid var(--border)',
                    fontFamily: 'SF Mono, Menlo, monospace',
                  }}>{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Telegram Guided Wizard ─── */

function TelegramWizard({ onConnected }) {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [chatFound, setChatFound] = useState(null);
  const [error, setError] = useState(null);

  const STEPS = [
    {
      title: 'Open BotFather',
      desc: 'BotFather is Telegram\'s official tool for creating bots. Click the button below to open it.',
      action: (
        <a href="https://t.me/BotFather" target="_blank" rel="noopener"
          className="btn-primary" style={{ display: 'inline-flex', gap: 8, textDecoration: 'none', padding: '12px 24px' }}>
          <span>📱</span> Open @BotFather
        </a>
      ),
    },
    {
      title: 'Create your bot',
      desc: 'Send BotFather this command. Then choose any name and username for your bot.',
      action: (
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: 12, padding: '14px 18px',
          fontFamily: 'SF Mono, Fira Code, Menlo, monospace', fontSize: 15,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>/newbot</span>
          <button onClick={() => navigator.clipboard.writeText('/newbot')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)' }}
            title="Copy">📋</button>
        </div>
      ),
    },
    {
      title: 'Paste your token',
      desc: 'BotFather will give you a token that looks like 123456789:ABCdef... — paste it here.',
      action: null, // custom render
    },
    {
      title: 'Send your bot a message',
      desc: 'Open your new bot on Telegram and send it any message (e.g. "hi"). This is needed so we can find your chat.',
      action: null, // dynamic — shows bot link
    },
    {
      title: 'You\'re connected!',
      desc: null,
      action: null,
    },
  ];

  const testToken = async () => {
    if (!token || token.length < 20) { setError('Token looks too short'); return; }
    setTesting(true);
    setError(null);
    try {
      const chat = await api.findTelegramChat(token);
      if (chat && chat.chat_id) {
        setChatFound(chat);
        // Save the channel
        await api.createChannel({
          type: 'telegram', name: `Telegram: ${chat.name}`,
          config: { bot_token: token, chat_id: chat.chat_id },
        });
        onConnected?.();
        setStep(4);
      } else {
        setError('No chat found yet — did you send your bot a message?');
      }
    } catch {
      setError('No chat found — send your bot a message first, then try again.');
    }
    setTesting(false);
  };

  const botUsername = token.length > 20 ? null : null; // We'll extract from BotFather later

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px', borderBottom: '1px solid var(--divider)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>📱</span>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Connect Telegram</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
            Get bot results on your phone — takes about 60 seconds
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        background: 'var(--bg-tertiary)',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Step content */}
      <div className="animate-in" style={{ padding: '24px' }}>
        {step < 5 && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 600, color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: 8,
            }}>
              Step {step + 1} of 5
            </div>
            <h4 style={{ fontSize: 17, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.01em' }}>
              {STEPS[step].title}
            </h4>
            {STEPS[step].desc && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                {STEPS[step].desc}
              </p>
            )}
          </>
        )}

        {/* Step 0 & 1: static action */}
        {(step === 0 || step === 1) && (
          <div>
            {STEPS[step].action}
            <div style={{ marginTop: 20 }}>
              <button onClick={() => setStep(step + 1)} className="btn-secondary"
                style={{ padding: '10px 20px' }}>
                Done, next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Token input */}
        {step === 2 && (
          <div>
            <input
              type="text"
              className="input-apple"
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwx..."
              value={token}
              onChange={e => { setToken(e.target.value); setError(null); }}
              style={{ fontFamily: 'SF Mono, Fira Code, Menlo, monospace', fontSize: 13 }}
              autoFocus
            />
            {error && (
              <div className="animate-in" style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 10,
                background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13,
              }}>{error}</div>
            )}
            <div style={{ marginTop: 16 }}>
              <button onClick={() => { if (token.length > 20) { setStep(3); setError(null); } else { setError('Please paste a valid bot token'); } }}
                className="btn-primary" style={{ padding: '10px 20px' }}
                disabled={token.length < 10}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Send message + find chat */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <a href={`https://t.me/`} target="_blank" rel="noopener"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 10,
                  background: '#0088CC', color: 'white',
                  textDecoration: 'none', fontSize: 14, fontWeight: 600,
                }}>
                Open your bot on Telegram →
              </a>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              Send your bot any message (like "hi"), then click the button below.
            </p>
            <button onClick={testToken} className="btn-primary"
              style={{ padding: '10px 20px', opacity: testing ? 0.6 : 1 }}
              disabled={testing}>
              {testing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="animate-spin">⏳</span> Looking for your chat...
                </span>
              ) : '🔍 Find my chat'}
            </button>
            {error && (
              <div className="animate-in" style={{
                marginTop: 12, padding: '12px 16px', borderRadius: 10,
                background: 'var(--warning-soft)', color: '#C93400', fontSize: 13, lineHeight: 1.5,
              }}>
                ⚠️ {error}
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Make sure you opened the bot and sent a message, then try again.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h4 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You're connected!</h4>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {chatFound?.name && (
                <>Linked to <strong>{chatFound.name}</strong> on Telegram.</>
              )}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
              Your bots will send results directly to your Telegram.
            </p>
            <button onClick={() => { setStep(0); setToken(''); setChatFound(null); setError(null); }}
              className="btn-secondary" style={{ padding: '10px 20px' }}>
              Done
            </button>
          </div>
        )}

        {/* Back button for steps 1-3 */}
        {step > 0 && step < 4 && (
          <button onClick={() => { setStep(step - 1); setError(null); }}
            style={{
              marginTop: 12, background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)',
            }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
