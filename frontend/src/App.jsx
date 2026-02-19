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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎛️</span>
          <h1 className="text-xl font-bold tracking-tight">openOrchestrator</h1>
        </div>
        <div className="flex items-center gap-4">
          {view.page !== 'dashboard' && (
            <button onClick={() => setView({ page: 'dashboard' })}
              className="text-sm text-gray-400 hover:text-white transition">← Dashboard</button>
          )}
          <button onClick={() => setShowNewBot(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition font-medium">
            + Neuer Bot
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
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
