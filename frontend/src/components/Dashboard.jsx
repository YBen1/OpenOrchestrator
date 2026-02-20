import { useState } from 'react';
import { Bot, Loader2, XCircle } from 'lucide-react';
import BotCard from './BotCard';

export default function Dashboard({ bots, activity, triggers, onSelect, onRun, onEdit, onRefresh }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em',
          color: 'var(--text-primary)', lineHeight: 1.15,
        }}>
          {getGreeting()}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-tertiary)', marginTop: 6, fontWeight: 400 }}>
          {bots.length === 0
            ? 'Create your first bot to get started.'
            : `${bots.length} bot${bots.length !== 1 ? 's' : ''} configured · ${activity.filter(a => a.status === 'completed').length} runs today`}
        </p>
      </div>

      <section style={{ marginBottom: 48 }}>
        <SectionHeader title="My Bots" count={bots.length} />
        {bots.length === 0 ? (
          <div className="card empty-state">
            <p className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}><Bot size={40} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} /></p>
            <p className="empty-title">No bots created yet</p>
            <p className="empty-desc">Click "+ New Bot" or choose a template</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {bots.map(bot => (
              <BotCard key={bot.id} bot={bot} onSelect={onSelect} onRun={onRun} onEdit={onEdit} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </section>

      {triggers.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <SectionHeader title="Connections" count={triggers.length} />
          <div className="card" style={{ overflow: 'hidden' }}>
            {triggers.map((t, i) => {
              const src = bots.find(b => b.id === t.source_bot);
              const tgt = bots.find(b => b.id === t.target_bot);
              return (
                <div key={t.id} style={{
                  padding: '14px 20px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 14,
                  borderTop: i > 0 ? '1px solid var(--divider)' : 'none',
                }}>
                  <Chip emoji={src?.emoji} label={src?.name || t.source_bot} />
                  <span style={{
                    color: 'var(--text-quaternary)', fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{t.event}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M3 8h10M10 5l3 3-3 3" stroke="var(--text-quaternary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <Chip emoji={tgt?.emoji} label={tgt?.name || t.target_bot} />
                  {!t.enabled && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)',
                      background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6,
                    }}>Paused</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ActivityFeed activity={activity} onSelect={onSelect} />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function SectionHeader({ title, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10,
      marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
        color: 'var(--text-primary)',
      }}>{title}</h2>
      {count != null && (
        <span style={{
          fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)',
        }}>{count}</span>
      )}
    </div>
  );
}

function Chip({ emoji, label }) {
  return (
    <span style={{
      background: 'var(--bg-tertiary)', borderRadius: 10, padding: '6px 12px',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
    }}>
      <span style={{ fontSize: 14 }}>{emoji || <Bot size={14} strokeWidth={1.5} />}</span>{label}
    </span>
  );
}

function ActivityFeed({ activity, onSelect }) {
  const [expanded, setExpanded] = useState(null);
  const STATUS = {
    running:   { color: '#C93400', label: 'Running', dotClass: 'pulse-dot' },
    completed: { color: '#248A3D', label: 'Done', dotClass: '' },
    failed:    { color: '#D70015', label: 'Error', dotClass: '' },
    timeout:   { color: '#C93400', label: 'Timeout', dotClass: '' },
    cancelled: { color: 'var(--text-tertiary)', label: 'Cancelled', dotClass: '' },
  };

  if (activity.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Recent Activity" count={activity.length} />
      <div className="card" style={{ overflow: 'hidden' }}>
        {activity.map((a, i) => {
          const s = STATUS[a.status] || STATUS.cancelled;
          const isOpen = expanded === a.id;
          return (
            <div key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--divider)' : 'none' }}>
              <div
                style={{
                  padding: '12px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  fontSize: 14, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                <span style={{
                  width: 44, color: 'var(--text-tertiary)', fontSize: 13,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>
                  {a.started_at ? new Date(a.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>

                <span style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, flexShrink: 0,
                }}>{a.bot_emoji}</span>

                <span
                  style={{
                    fontWeight: 600, fontSize: 13, width: 100, flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onClick={e => { e.stopPropagation(); if (a.bot_id) onSelect(a.bot_id); }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                >{a.bot_name}</span>

                <span style={{
                  color: 'var(--text-secondary)', flex: 1, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13,
                }}>
                  {a.output_preview || '—'}
                </span>

                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 600, color: s.color, flexShrink: 0,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: s.color,
                  }} className={s.dotClass} />
                  {s.label}
                </span>

                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                  <path d="M3 4.5l3 3 3-3" stroke="var(--text-quaternary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {isOpen && (
                <div className="animate-in" style={{ padding: '4px 20px 16px 88px' }}>
                  <div className="log-output" style={{ maxHeight: 256 }}>
                    {a.output || a.output_preview || (
                      <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {a.status === 'running' ? <><Loader2 size={14} className="animate-spin" /> Bot is still running...</> :
                         a.status === 'failed' ? <><XCircle size={14} /> Run failed.</> :
                         'No result.'}
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', gap: 16, marginTop: 10,
                    fontSize: 12, color: 'var(--text-tertiary)',
                  }}>
                    {a.duration_ms != null && <span>{(a.duration_ms / 1000).toFixed(1)}s</span>}
                    {(a.tokens_in || a.tokens_out) ? <span>{((a.tokens_in||0)+(a.tokens_out||0)).toLocaleString('en-US')} Tokens</span> : null}
                    {a.cost_estimate ? <span>${a.cost_estimate.toFixed(4)}</span> : null}
                  </div>
                  {a.error_message && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', borderRadius: 10,
                      fontSize: 12, background: 'var(--danger-soft)', color: 'var(--danger)',
                      lineHeight: 1.5,
                    }}>
                      {a.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
