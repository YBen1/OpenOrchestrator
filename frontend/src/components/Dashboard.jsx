import { useState } from 'react';
import BotCard from './BotCard';

export default function Dashboard({ bots, activity, triggers, onSelect, onRun, onEdit, onRefresh }) {
  return (
    <div className="space-y-10">
      {/* Bots */}
      <section>
        <SectionHeader title="Meine Bots" count={bots.length} />
        {bots.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-icon">🤖</p>
            <p className="empty-title">Noch keine Bots erstellt</p>
            <p className="empty-desc">Klicke auf „+ Neuer Bot" oder wähle eine Vorlage</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(bot => (
              <BotCard key={bot.id} bot={bot} onSelect={onSelect} onRun={onRun} onEdit={onEdit} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </section>

      {/* Triggers */}
      {triggers.length > 0 && (
        <section>
          <SectionHeader title="Verknüpfungen" count={triggers.length} />
          <div className="card divide-styled">
            {triggers.map(t => {
              const src = bots.find(b => b.id === t.source_bot);
              const tgt = bots.find(b => b.id === t.target_bot);
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3" style={{ fontSize: 14 }}>
                  <Chip emoji={src?.emoji} label={src?.name || t.source_bot} />
                  <span style={{ color: 'var(--text-quaternary)', fontSize: 12, fontWeight: 500 }}>→ {t.event} →</span>
                  <Chip emoji={tgt?.emoji} label={tgt?.name || t.target_bot} />
                  {!t.enabled && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>deaktiviert</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity */}
      <ActivityFeed activity={activity} onSelect={onSelect} />
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="section-title">{title}</h2>
      {count != null && (
        <span style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
          background: 'var(--bg-tertiary)', padding: '1px 8px', borderRadius: 8,
        }}>{count}</span>
      )}
    </div>
  );
}

function Chip({ emoji, label }) {
  return (
    <span style={{
      background: 'var(--bg-tertiary)', borderRadius: 8, padding: '4px 10px',
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
    }}>
      <span>{emoji || '🤖'}</span>{label}
    </span>
  );
}

function ActivityFeed({ activity, onSelect }) {
  const [expanded, setExpanded] = useState(null);
  const STATUS = {
    running:   { bg: 'var(--warning-soft)', color: '#C93400', label: 'Läuft' },
    completed: { bg: 'var(--success-soft)', color: '#248A3D', label: 'Fertig' },
    failed:    { bg: 'var(--danger-soft)',  color: '#D70015', label: 'Fehler' },
    timeout:   { bg: 'var(--warning-soft)', color: '#C93400', label: 'Timeout' },
    cancelled: { bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)', label: 'Abgebrochen' },
  };

  return (
    <section>
      <SectionHeader title="Letzte Aktivität" count={activity.length} />
      {activity.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Noch keine Aktivität.</p>
      ) : (
        <div className="card divide-styled">
          {activity.map(a => {
            const s = STATUS[a.status] || STATUS.cancelled;
            const isOpen = expanded === a.id;
            return (
              <div key={a.id}>
                <div className="px-5 py-3 flex items-center gap-3 cursor-pointer"
                  style={{ fontSize: 14, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setExpanded(isOpen ? null : a.id)}>

                  <span style={{ width: 44, color: 'var(--text-tertiary)', fontSize: 13, flexShrink: 0 }}>
                    {a.started_at ? new Date(a.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, background: 'var(--bg-tertiary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>{a.bot_emoji}</span>
                  <span style={{ fontWeight: 500, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); if (a.bot_id) onSelect(a.bot_id); }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  >{a.bot_name}</span>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {a.output_preview || '—'}
                  </span>
                  <span className="status-pill" style={{ background: s.bg, color: s.color, flexShrink: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}
                      className={a.status === 'running' ? 'pulse-dot' : ''} />
                    {s.label}
                  </span>
                  <span style={{
                    color: 'var(--text-quaternary)', fontSize: 10,
                    transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none',
                  }}>▼</span>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 pt-1 animate-in">
                    <div className="log-output" style={{ maxHeight: 256 }}>
                      {a.output || a.output_preview || (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                          {a.status === 'running' ? '⏳ Bot läuft noch...' :
                           a.status === 'failed' ? '❌ Run fehlgeschlagen.' :
                           'Kein Ergebnis.'}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {a.duration_ms != null && <span>{(a.duration_ms / 1000).toFixed(1)}s</span>}
                      {(a.tokens_in || a.tokens_out) ? <span>{((a.tokens_in||0)+(a.tokens_out||0)).toLocaleString('de-DE')} Tokens</span> : null}
                      {a.cost_estimate ? <span>${a.cost_estimate.toFixed(4)}</span> : null}
                    </div>
                    {a.error_message && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                        {a.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
