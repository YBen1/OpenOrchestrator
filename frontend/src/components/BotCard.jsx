import { api } from '../api';

const SCHEDULE_LABELS = {
  '*/5 * * * *': 'Every 5 min', '*/15 * * * *': 'Every 15 min',
  '*/30 * * * *': 'Every 30 min', '0 * * * *': 'Hourly',
  '0 */6 * * *': 'Every 6h', '0 9 * * *': 'Daily', '0 9 * * 1': 'Weekly',
};

const STATUS_COLORS = {
  running:   '#FF9F0A',
  completed: '#30D158',
  failed:    '#FF3B30',
};

export default function BotCard({ bot, onSelect, onRun, onEdit, onRefresh }) {
  const disabled = bot.enabled === false;
  const statusColor = STATUS_COLORS[bot.last_status] || 'var(--text-quaternary)';
  const isRunning = bot.last_status === 'running';

  return (
    <div
      onClick={() => onSelect(bot.id)}
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '20px 20px 16px',
        cursor: 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Top row: emoji + name + schedule */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>{bot.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{
              fontSize: 15, fontWeight: 600, lineHeight: 1.3, margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{bot.name}</h3>
            {disabled && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>Paused</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{bot.model}</span>
        </div>
        {bot.schedule && (
          <span style={{
            fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500,
            background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 6, flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {SCHEDULE_LABELS[bot.schedule] || bot.schedule}
          </span>
        )}
      </div>

      {/* Description */}
      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {bot.description || bot.prompt}
      </p>

      {/* Bottom row: status + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 14, borderTop: '1px solid var(--divider)',
      }}>
        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusColor,
          }} className={isRunning ? 'pulse-dot' : ''} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>
            {isRunning ? 'Running' : bot.last_status === 'failed' ? 'Error' : bot.last_status === 'completed' ? 'Ready' : 'Ready'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onRun(bot.id)} disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 14px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z"/></svg>
            Run
          </button>
          {onEdit && (
            <button onClick={() => onEdit(bot)}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >✏️</button>
          )}
          {onRefresh && (
            <button onClick={async () => { await api.duplicateBot(bot.id); onRefresh(); }}
              title="Duplicate"
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >📋</button>
          )}
        </div>
      </div>
    </div>
  );
}
