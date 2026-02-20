import { useState, useEffect } from 'react';
import { api } from './api';
import Dashboard from './components/Dashboard';
import BotDetail from './components/BotDetail';
import NewBotModal from './components/NewBotModal';

export default function App() {
  const [bots, setBots] = useState([]);
  const [view, setView] = useState({ page: 'dashboard' });
  const [showNewBot, setShowNewBot] = useState(false);
  const [activity, setActivity] = useState([]);
  const [triggers, setTriggers] = useState([]);

  const refresh = async () => {
    const [b, a, t] = await Promise.all([api.listBots(), api.activity(), api.listTriggers()]);
    setBots(b);
    setActivity(a);
    setTriggers(t);
  };

  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header — frosted glass */}
      <header style={{
        background: 'rgba(242, 242, 247, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }} className="px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          {view.page !== 'dashboard' && (
            <button onClick={() => setView({ page: 'dashboard' })}
              className="btn-secondary" style={{ fontSize: 13 }}>
              ← Dashboard
            </button>
          )}
          <button onClick={() => setShowNewBot(true)} className="btn-primary">
            + Neuer Bot
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-8 py-8">
        {view.page === 'dashboard' ? (
          <Dashboard bots={bots} activity={activity} triggers={triggers}
            onSelect={(id) => setView({ page: 'detail', botId: id })}
            onRun={async (id) => { await api.runBot(id); refresh(); }}
            onRefresh={refresh} />
        ) : (
          <BotDetail botId={view.botId} onBack={() => setView({ page: 'dashboard' })} onRefresh={refresh} />
        )}
      </main>

      {showNewBot && (
        <NewBotModal
          bots={bots}
          onClose={() => setShowNewBot(false)}
          onCreate={async (data) => { await api.createBot(data); setShowNewBot(false); refresh(); }}
        />
      )}
    </div>
  );
}
