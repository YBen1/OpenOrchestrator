import { useState, useEffect } from 'react';
import { api } from './api';
import Dashboard from './components/Dashboard';
import BotDetail from './components/BotDetail';
import NewBotModal from './components/NewBotModal';
import EditBotModal from './components/EditBotModal';
import Settings from './components/Settings';
import TemplateGallery from './components/TemplateGallery';

export default function App() {
  const [bots, setBots] = useState([]);
  const [view, setView] = useState({ page: 'dashboard' });
  const [showNewBot, setShowNewBot] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activity, setActivity] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [hasKeys, setHasKeys] = useState(true);

  const refresh = async () => {
    const [b, a, t] = await Promise.all([api.listBots(), api.activity(), api.listTriggers()]);
    setBots(b);
    setActivity(a);
    setTriggers(t);
  };

  const checkKeys = async () => {
    try {
      const s = await api.getSettings();
      setHasKeys(s.openai_api_key_set || s.anthropic_api_key_set || s.google_api_key_set || s.mistral_api_key_set || !!s.ollama_base_url);
    } catch {
      setHasKeys(false);
    }
  };

  useEffect(() => {
    refresh();
    checkKeys();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(242, 242, 247, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }} className="px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView({ page: 'dashboard' })}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, fontWeight: 700,
          }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            openOrchestrator
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {view.page !== 'dashboard' && view.page !== 'settings' && (
            <button onClick={() => setView({ page: 'dashboard' })}
              className="btn-secondary" style={{ fontSize: 13 }}>
              ← Dashboard
            </button>
          )}
          <button onClick={() => setView({ page: 'settings' })} style={{
            width: 36, height: 36, borderRadius: 10,
            background: view.page === 'settings' ? 'rgba(0,0,0,0.06)' : 'transparent',
            border: 'none', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={e => { if (view.page !== 'settings') e.currentTarget.style.background = 'transparent' }}
          >⚙️</button>
          <button onClick={() => setShowTemplates(true)} className="btn-secondary" style={{ fontSize: 13 }}>
            📋 Vorlagen
          </button>
          <button onClick={() => setShowNewBot(true)} className="btn-primary">
            + Neuer Bot
          </button>
        </div>
      </header>

      {/* No API key banner */}
      {!hasKeys && view.page === 'dashboard' && (
        <div className="animate-in" style={{
          maxWidth: '72rem', margin: '16px auto 0', padding: '0 32px',
        }}>
          <div style={{
            background: 'rgba(255, 149, 0, 0.08)',
            border: '1px solid rgba(255, 149, 0, 0.2)',
            borderRadius: 12, padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 14,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ color: '#C93400', flex: 1 }}>
              Kein API-Key konfiguriert. Bots können nur im Mock-Modus laufen.
            </span>
            <button onClick={() => setView({ page: 'settings' })} className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
              Jetzt einrichten
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-8 py-8">
        {view.page === 'dashboard' ? (
          <Dashboard bots={bots} activity={activity} triggers={triggers}
            onSelect={(id) => setView({ page: 'detail', botId: id })}
            onRun={async (id) => { await api.runBot(id); refresh(); }}
            onEdit={(bot) => setEditBot(bot)}
            onRefresh={refresh} />
        ) : view.page === 'settings' ? (
          <Settings onBack={() => { setView({ page: 'dashboard' }); checkKeys(); }} />
        ) : (
          <BotDetail
            botId={view.botId}
            onBack={() => setView({ page: 'dashboard' })}
            onRefresh={refresh}
            onEdit={(bot) => setEditBot(bot)}
          />
        )}
      </main>

      {showNewBot && (
        <NewBotModal
          bots={bots}
          onClose={() => setShowNewBot(false)}
          onCreate={async (data) => { await api.createBot(data); setShowNewBot(false); refresh(); }}
        />
      )}

      {showTemplates && (
        <TemplateGallery
          onClose={() => setShowTemplates(false)}
          onCreate={async (data) => { await api.createBot(data); setShowTemplates(false); refresh(); }}
        />
      )}

      {editBot && (
        <EditBotModal
          bot={editBot}
          onClose={() => setEditBot(null)}
          onSave={async (data) => { await api.updateBot(editBot.id, data); setEditBot(null); refresh(); }}
        />
      )}
    </div>
  );
}
