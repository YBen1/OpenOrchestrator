import { useState } from 'react';
import BotCard from './BotCard';

export default function Dashboard({ bots, activity, triggers, onSelect, onRun, onEdit, onRefresh }) {
  return (
    <div className="space-y-10">
      {/* Bot Grid */}
      <section>
        <SectionHeader title="Meine Bots" count={bots.length} />
        {bots.length === 0 ? (
          <div className="glass-card text-center py-20" style={{ color: 'var(--text-tertiary)' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🤖</p>
            <p style={{ fontSize: 15, fontWeight: 500 }}>Noch keine Bots erstellt</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Klicke auf „+ Neuer Bot" um loszulegen</p>
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
          <div className="glass-card divide-y" style={{ borderColor: 'var(--divider)' }}>
            {triggers.map(t => {
              const src = bots.find(b => b.id === t.source_bot);
              const tgt = bots.find(b => b.id === t.target_bot);
              return (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3" style={{ fontSize: 14 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, background: 'var(--bg)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>{src?.emoji || '🤖'}</span>
                  <span style={{ fontWeight: 500 }}>{src?.name || t.source_bot}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>── {t.event} ──▶</span>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, background: 'var(--bg)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  }}>{tgt?.emoji || '🤖'}</span>
                  <span style={{ fontWeight: 500 }}>{tgt?.name || t.target_bot}</span>
                  {!t.enabled && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>deaktiviert</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity Feed */}
      <ActivityFeed activity={activity} bots={bots} onSelect={onSelect} />
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{title}</h2>
      {count != null && (
        <span style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 10,
        }}>{count}</span>
      )}
    </div>
  );
}

function ActivityFeed({ activity, bots, onSelect }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <section>
      <SectionHeader title="Letzte Aktivität" count={activity.length} />
      {activity.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Noch keine Aktivität.</p>
      ) : (
        <div className="glass-card divide-y" style={{ borderColor: 'var(--divider)' }}>
          {activity.map(a => (
            <div key={a.id} className="animate-in">
              <div
                className="px-5 py-3.5 flex items-center gap-3 cursor-pointer"
                style={{ fontSize: 14, transition: 'background 0.15s ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <span style={{ width: 48, color: 'var(--text-tertiary)', fontSize: 13, flexShrink: 0 }}>
                  {a.started_at ? new Date(a.started_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, background: 'var(--bg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>{a.bot_emoji}</span>
                <span
                  style={{ fontWeight: 500, width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); if (a.bot_id) onSelect(a.bot_id); }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                >{a.bot_name}</span>
                <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                  {a.output_preview || '—'}
                </span>
                <StatusPill status={a.status} />
                <span style={{
                  color: 'var(--text-tertiary)', fontSize: 10,
                  transition: 'transform 0.2s ease',
                  transform: expanded === a.id ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>▼</span>
              </div>
              {expanded === a.id && (
                <div className="px-5 pb-4 pt-1 animate-in">
                  <div style={{
                    background: 'var(--bg)', borderRadius: 12, padding: 16,
                    fontSize: 13, color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap', maxHeight: 256, overflowY: 'auto',
                    lineHeight: 1.6,
                  }}>
                    {a.output || a.output_preview || (
                      <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                        {a.status === 'running' ? '⏳ Bot läuft noch...' :
                         a.status === 'failed' ? '❌ Run fehlgeschlagen — kein Output.' :
                         'Kein Ergebnis vorhanden.'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                    {a.duration_ms != null && <span>Dauer: {(a.duration_ms / 1000).toFixed(1)}s</span>}
                    {(a.tokens_in || a.tokens_out) ? (
                      <span>{((a.tokens_in || 0) + (a.tokens_out || 0)).toLocaleString('de-DE')} Tokens</span>
                    ) : null}
                    {a.cost_estimate ? <span>${a.cost_estimate.toFixed(4)}</span> : null}
                  </div>
                  {a.error_message && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(255, 59, 48, 0.06)', color: '#D70015',
                    }}>
                      {a.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }) {
  const styles = {
    running: { bg: 'rgba(255, 149, 0, 0.1)', color: '#C93400', dot: '#FF9500' },
    completed: { bg: 'rgba(52, 199, 89, 0.1)', color: '#248A3D', dot: '#34C759' },
    failed: { bg: 'rgba(255, 59, 48, 0.1)', color: '#D70015', dot: '#FF3B30' },
    cancelled: { bg: 'rgba(142, 142, 147, 0.1)', color: '#636366', dot: '#8E8E93' },
  };
  const labels = { running: 'Läuft', completed: 'Fertig', failed: 'Fehler', cancelled: 'Abgebrochen' };
  const s = styles[status] || styles.cancelled;

  return (
    <span className="status-pill" style={{ background: s.bg, color: s.color, flexShrink: 0 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block',
      }} className={status === 'running' ? 'pulse-dot' : ''} />
      {labels[status] || status}
    </span>
  );
}
