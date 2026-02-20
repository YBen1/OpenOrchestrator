export default function BotCard({ bot, onSelect, onRun }) {
  const statusColors = {
    running: { bg: 'rgba(52, 199, 89, 0.1)', dot: '#34C759', text: '#248A3D' },
    completed: { bg: 'rgba(52, 199, 89, 0.1)', dot: '#34C759', text: '#248A3D' },
    failed: { bg: 'rgba(255, 59, 48, 0.1)', dot: '#FF3B30', text: '#D70015' },
    idle: { bg: 'rgba(142, 142, 147, 0.1)', dot: '#8E8E93', text: '#636366' },
  };
  const s = statusColors[bot.last_status] || statusColors.idle;

  return (
    <div
      className="glass-card hover-lift p-5 cursor-pointer"
      onClick={() => onSelect(bot.id)}
      style={{ transition: 'all 0.2s ease' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            {bot.emoji}
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {bot.name}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{bot.model}</span>
          </div>
        </div>
        {bot.schedule && (
          <span style={{
            fontSize: 11, color: 'var(--text-secondary)',
            background: 'var(--bg)', padding: '3px 8px', borderRadius: 8,
          }}>⏰ {bot.schedule}</span>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
        marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {bot.description || bot.prompt}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="status-pill" style={{ background: s.bg, color: s.text }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: s.dot,
            display: 'inline-block',
          }} className={bot.last_status === 'running' ? 'pulse-dot' : ''} />
          {bot.last_status || 'Bereit'}
        </div>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onRun(bot.id)} className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
            ▶ Run
          </button>
          <button onClick={() => onSelect(bot.id)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}>
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
