import { api } from '../api';

const SCHEDULE_LABELS = {
  '*/5 * * * *': 'Alle 5 Min', '*/15 * * * *': 'Alle 15 Min',
  '*/30 * * * *': 'Alle 30 Min', '0 * * * *': 'Stündlich',
  '0 */6 * * *': 'Alle 6h', '0 9 * * *': 'Täglich', '0 9 * * 1': 'Wöchentlich',
};

const STATUS = {
  running:   { bg: 'var(--warning-soft)', color: '#C93400', dot: 'var(--warning)', label: 'Läuft' },
  completed: { bg: 'var(--success-soft)', color: '#248A3D', dot: 'var(--success)', label: 'Fertig' },
  failed:    { bg: 'var(--danger-soft)',  color: '#D70015', dot: 'var(--danger)',  label: 'Fehler' },
  idle:      { bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)', dot: 'var(--text-quaternary)', label: 'Bereit' },
};

export default function BotCard({ bot, onSelect, onRun, onEdit, onRefresh }) {
  const disabled = bot.enabled === false;
  const s = STATUS[bot.last_status] || STATUS.idle;

  return (
    <div className="card hover-lift cursor-pointer" onClick={() => onSelect(bot.id)}
      style={{ padding: 20, opacity: disabled ? 0.5 : 1 }}>

      <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 40, height: 40, borderRadius: 11, background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            flexShrink: 0,
          }}>{bot.emoji}</div>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {bot.name}
              </h3>
              {disabled && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>PAUSIERT</span>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{bot.model}</span>
          </div>
        </div>
        {bot.schedule && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
            ⏰ {SCHEDULE_LABELS[bot.schedule] || bot.schedule}
          </span>
        )}
      </div>

      <p style={{
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {bot.description || bot.prompt}
      </p>

      <div className="flex items-center justify-between">
        <span className="status-pill" style={{ background: s.bg, color: s.color }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }}
            className={bot.last_status === 'running' ? 'pulse-dot' : ''} />
          {s.label}
        </span>
        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onRun(bot.id)} className="btn-primary" disabled={disabled}
            style={{ padding: '5px 12px', fontSize: 12, borderRadius: 8 }}>▶ Run</button>
          {onEdit && <button onClick={() => onEdit(bot)} className="btn-ghost" style={{ fontSize: 14 }}>✏️</button>}
          {onRefresh && <button onClick={async () => { await api.duplicateBot(bot.id); onRefresh(); }}
            className="btn-ghost" style={{ fontSize: 14 }} title="Duplizieren">📋</button>}
        </div>
      </div>
    </div>
  );
}
