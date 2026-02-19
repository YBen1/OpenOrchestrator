import BotCard from './BotCard';

export default function Dashboard({ bots, activity, triggers, onSelect, onRun, onRefresh }) {
  return (
    <div className="space-y-8">
      {/* Bot Grid */}
      <section>
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Meine Bots</h2>
        {bots.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🤖</p>
            <p>Noch keine Bots. Erstelle deinen ersten!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(bot => (
              <BotCard key={bot.id} bot={bot} onSelect={onSelect} onRun={onRun} />
            ))}
          </div>
        )}
      </section>

      {/* Triggers */}
      {triggers.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Verknüpfungen</h2>
          <div className="space-y-2">
            {triggers.map(t => {
              const src = bots.find(b => b.id === t.source_bot);
              const tgt = bots.find(b => b.id === t.target_bot);
              return (
                <div key={t.id} className="bg-gray-900 rounded-lg px-4 py-3 flex items-center gap-3 text-sm border border-gray-800">
                  <span>{src?.emoji || '🤖'} {src?.name || t.source_bot}</span>
                  <span className="text-gray-500">──{t.event}──▶</span>
                  <span>{tgt?.emoji || '🤖'} {tgt?.name || t.target_bot}</span>
                  {!t.enabled && <span className="ml-auto text-gray-600 text-xs">deaktiviert</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity Feed */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-300">Letzte Aktivität</h2>
        {activity.length === 0 ? (
          <p className="text-gray-600 text-sm">Noch keine Aktivität.</p>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
            {activity.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                <span className="w-16 text-gray-500 shrink-0">
                  {a.started_at ? new Date(a.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span>{a.bot_emoji}</span>
                <span className="font-medium w-28 truncate">{a.bot_name}</span>
                <span className="text-gray-400 flex-1 truncate">{a.output_preview || '—'}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    running: 'bg-green-500/20 text-green-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };
  const icons = { running: '🟢', completed: '✅', failed: '❌', cancelled: '⏸️' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] || colors.cancelled}`}>
      {icons[status] || '?'} {status}
    </span>
  );
}
