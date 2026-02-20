import { useState, useEffect } from 'react';
import { Zap, Search, Link, Settings as SettingsIcon, Moon, Sun } from 'lucide-react';
import { api } from './api';
import Dashboard from './components/Dashboard';
import BotDetail from './components/BotDetail';
import NewBotModal from './components/NewBotModal';
import EditBotModal from './components/EditBotModal';
import Settings from './components/Settings';
import Pipelines from './components/Pipelines';
import SearchModal from './components/Search';
import TemplateGallery from './components/TemplateGallery';
import Onboarding from './components/Onboarding';

export default function App() {
  const [bots, setBots] = useState([]);
  const [view, setView] = useState({ page: 'dashboard' });
  const [showNewBot, setShowNewBot] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('onboarded'));
  const [activity, setActivity] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [hasKeys, setHasKeys] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); setShowNewBot(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setView({ page: 'settings' }); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const refresh = async () => {
    const [b, a, t] = await Promise.all([api.listBots(), api.activity(), api.listTriggers()]);
    setBots(b); setActivity(a); setTriggers(t);
  };

  const checkKeys = async () => {
    try {
      const s = await api.getSettings();
      setHasKeys(s.openai_api_key_set || s.anthropic_api_key_set || s.google_api_key_set || s.mistral_api_key_set || !!s.ollama_base_url);
    } catch { setHasKeys(false); }
  };

  useEffect(() => { refresh(); checkKeys(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, []);

  const nav = (page) => setView({ page });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="header-bar" style={{ padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 200 }} onClick={() => nav('dashboard')}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
          }}><Zap size={16} strokeWidth={2} /></div>
          <span style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.02em' }}>openOrchestrator</span>
        </div>

        <button onClick={() => setShowSearch(true)} style={{
          height: 32, borderRadius: 8, padding: '0 14px',
          background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
          cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', gap: 8, minWidth: 220,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <Search size={14} strokeWidth={1.5} style={{ opacity: 0.4, flexShrink: 0 }} />
          <span>Search...</span>
          <kbd style={{ fontSize: 10, marginLeft: 'auto', opacity: 0.35, fontFamily: 'inherit' }}>⌘K</kbd>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 200, justifyContent: 'flex-end' }}>
          <button className="icon-btn" data-active={view.page === 'pipelines'} onClick={() => nav('pipelines')} title="Pipelines"
            style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Link size={18} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" data-active={view.page === 'settings'} onClick={() => nav('settings')} title="Settings"
            style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SettingsIcon size={18} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? 'Light Mode' : 'Dark Mode'}
            style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {darkMode ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
          <button onClick={() => setShowTemplates(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >Templates</button>
          <button onClick={() => setShowNewBot(true)} className="btn-primary" style={{
            fontSize: 13, padding: '6px 16px', borderRadius: 8, fontWeight: 600,
          }}>+ New Bot</button>
        </div>
      </header>

      {/* No key banner */}
      {!hasKeys && view.page === 'dashboard' && (
        <div className="animate-in" style={{ maxWidth: '72rem', margin: '12px auto 0', padding: '0 24px' }}>
          <div style={{
            background: 'var(--warning-soft)', border: '1px solid rgba(255, 159, 10, 0.15)',
            borderRadius: 12, padding: '10px 18px',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#FF9F0A" style={{ flexShrink: 0 }}>
              <path d="M8 1l7 13H1L8 1zm0 4.5v4m0 1.5v1"/>
            </svg>
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
              No API key configured — bots run in mock mode only.
            </span>
            <button onClick={() => nav('settings')} style={{
              padding: '5px 14px', fontSize: 12, fontWeight: 600,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#FF9F0A', color: '#fff',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Set up
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-6">
        {view.page === 'dashboard' ? (
          <Dashboard bots={bots} activity={activity} triggers={triggers}
            onSelect={(id) => setView({ page: 'detail', botId: id })}
            onRun={async (id) => { await api.runBot(id); refresh(); }}
            onEdit={(bot) => setEditBot(bot)}
            onRefresh={refresh} />
        ) : view.page === 'pipelines' ? (
          <Pipelines bots={bots} onBack={() => nav('dashboard')} />
        ) : view.page === 'settings' ? (
          <Settings onBack={() => { nav('dashboard'); checkKeys(); }} />
        ) : (
          <BotDetail botId={view.botId} onBack={() => nav('dashboard')}
            onRefresh={refresh} onEdit={(bot) => setEditBot(bot)} />
        )}
      </main>

      {showOnboarding && (
        <Onboarding onComplete={() => { setShowOnboarding(false); localStorage.setItem('onboarded', '1'); checkKeys(); }} />
      )}
      {showSearch && (
        <SearchModal onClose={() => setShowSearch(false)} onSelect={(id) => setView({ page: 'detail', botId: id })} />
      )}
      {showNewBot && (
        <NewBotModal bots={bots} onClose={() => setShowNewBot(false)}
          onCreate={async (data) => { await api.createBot(data); setShowNewBot(false); refresh(); }} />
      )}
      {showTemplates && (
        <TemplateGallery onClose={() => setShowTemplates(false)}
          onCreate={async (data) => { await api.createBot(data); setShowTemplates(false); refresh(); }} />
      )}
      {editBot && (
        <EditBotModal bot={editBot} onClose={() => setEditBot(null)}
          onSave={async (data) => { await api.updateBot(editBot.id, data); setEditBot(null); refresh(); }} />
      )}
    </div>
  );
}
