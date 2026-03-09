import { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, XCircle } from 'lucide-react';
import BotCard from './BotCard';
import BotEmoji from './BotEmoji';

export default function Dashboard({ bots, activity, triggers, onSelect, onRun, onEdit, onRefresh }) {
  const [botStatuses, setBotStatuses] = useState({});
  const wsRefs = useRef({});

  useEffect(() => {
    Object.keys(wsRefs.current).forEach(id => {
      if (!bots.find(b => String(b.id) === String(id))) {
        wsRefs.current[id].close();
        delete wsRefs.current[id];
      }
    });
    bots.forEach(bot => {
      if (wsRefs.current[bot.id]) {return;}
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/bots/${bot.id}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'status' && msg.status) {
            setBotStatuses(prev => ({ ...prev, [bot.id]: msg.status }));
            if (msg.status === 'completed' && onRefresh) {onRefresh();}
          }
          if (msg.type === 'run_complete' && onRefresh) {onRefresh();}
        } catch {}
      };
      ws.onclose = () => { delete wsRefs.current[bot.id]; };
      wsRefs.current[bot.id] = ws;
    });
    return () => {
      Object.values(wsRefs.current).forEach(ws => ws.close());
      wsRefs.current = {};
    };
  }, [bots]);

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

      <StatsCards activity={activity} />
      <ActivityTimeline activity={activity} onSelect={onSelect} />

      <section style={{ marginBottom: 48 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <SectionHeader title="My Bots" count={bots.length} />
          <ImportBotButton onImported={onRefresh} />
        </div>
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
            gap: 18,
          }}>
            {bots.map(bot => (
              <BotCard key={bot.id} bot={bot} liveStatus={botStatuses[bot.id]} onSelect={onSelect} onRun={onRun} onEdit={onEdit} onRefresh={onRefresh} />
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
                  <Chip label={src?.name || t.source_bot} emoji={src?.emoji} />
                  <span style={{
                    color: 'var(--text-quaternary)', fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>{t.event}</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M3 8h10M10 5l3 3-3 3" stroke="var(--text-quaternary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <Chip label={tgt?.name || t.target_bot} emoji={tgt?.emoji} />
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

/* ─── Stats Cards ─── */

function formatNumber(n) {
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(1) + 'M';}
  if (n >= 1_000) {return (n / 1_000).toFixed(1) + 'k';}
  return String(n);
}

function StatsCards({ activity }) {
  if (!activity || activity.length === 0) {return null;}

  const total = activity.length;
  const completed = activity.filter(a => a.status === 'completed').length;
  const rate = total > 0 ? (completed / total) * 100 : 0;
  const rateColor = rate > 90 ? '#248A3D' : rate >= 70 ? '#B25000' : '#D70015';
  const totalTokens = activity.reduce((s, a) => s + (a.tokens_used || ((a.tokens_in || 0) + (a.tokens_out || 0)) || 0), 0);
  const totalCost = activity.reduce((s, a) => s + (a.cost_estimate || 0), 0);

  const cards = [
    { label: 'Total Runs', value: String(total), color: '#007AFF' },
    { label: 'Success Rate', value: rate.toFixed(1) + '%', color: rateColor },
    { label: 'Total Tokens', value: formatNumber(totalTokens), color: '#8B5CF6' },
    { label: 'Total Cost', value: '$' + totalCost.toFixed(2), color: '#F97316' },
  ];

  return (
    <section style={{ marginBottom: 32 }}>
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
      }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderLeft: `4px solid ${c.color}`,
            borderRadius: 16,
            padding: 20,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
              {c.value}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4,
            }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Activity Timeline ─── */

function relativeTime(dateStr) {
  if (!dateStr) {return '';}
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) {return 'just now';}
  const mins = Math.floor(secs / 60);
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PILL_STYLES = {
  completed: { bg: '#248A3D22', color: '#248A3D' },
  failed:    { bg: '#D7001522', color: '#D70015' },
  running:   { bg: '#007AFF22', color: '#007AFF' },
  cancelled: { bg: '#88888822', color: '#888888' },
  timeout:   { bg: '#C9340022', color: '#C93400' },
};

function ActivityTimeline({ activity, onSelect }) {
  if (!activity || activity.length === 0) {return null;}
  const recent = activity.slice(0, 10);

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionHeader title="Recent Activity" count={recent.length} />
      <div className="card" style={{ overflow: 'hidden' }}>
        {recent.map((a, i) => {
          const pill = PILL_STYLES[a.status] || PILL_STYLES.cancelled;
          const tokens = a.tokens_used || ((a.tokens_in || 0) + (a.tokens_out || 0)) || 0;
          return (
            <div key={a.id} style={{
              padding: '10px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 13,
              borderTop: i > 0 ? '1px solid var(--divider)' : 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => a.bot_id && onSelect(a.bot_id)}
            >
              <BotEmoji emoji={a.bot_emoji} name={a.bot_name} size={22} />
              <span style={{
                fontWeight: 600, minWidth: 80, maxWidth: 120,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{a.bot_name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                background: pill.bg, color: pill.color,
              }}>{a.status}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>
                {tokens > 0 && <span style={{ marginRight: 10 }}>{formatNumber(tokens)} tok</span>}
                {relativeTime(a.started_at)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Helpers ─── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) {return 'Good Morning';}
  if (h < 18) {return 'Good Afternoon';}
  return 'Good Evening';
}

function ImportBotButton({ onImported }) {
  const fileRef = useRef(null);
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) {return;}
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.importBot(data);
      if (onImported) {onImported();}
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    if (fileRef.current) {fileRef.current.value = '';}
  };
  return (
    <>
      <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px' }}>
        <Upload size={14} strokeWidth={1.5} /> Import Bot
      </button>
    </>
  );
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

function Chip({ label, emoji }) {
  return (
    <span style={{
      background: 'var(--bg-tertiary)', borderRadius: 10, padding: '6px 12px',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
    }}>
      <BotEmoji emoji={emoji} name={label} size={20} />{label}
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

  if (activity.length === 0) {return null;}

  return (
    <section>
      <SectionHeader title="Activity Log" count={activity.length} />
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

                <BotEmoji emoji={a.bot_emoji} name={a.bot_name} size={28} />

                <span
                  style={{
                    fontWeight: 600, fontSize: 13, width: 100, flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onClick={e => { e.stopPropagation(); if (a.bot_id) {onSelect(a.bot_id);} }}
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
