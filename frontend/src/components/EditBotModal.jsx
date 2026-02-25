// lucide-react icons imported via NewBotModal
import { useState, useEffect } from "react";
import { SIMPLE_MODELS, SIMPLE_MODEL_VALUES, GroupedModelOptions } from "./modelCatalog.jsx";
import { ModalHeader, Field, GroupedToolSelector, AdvancedSection, useSessionToggle } from "./NewBotModal";
import BotEmoji from "./BotEmoji";
import EmojiPicker from "./EmojiPicker";
import { api } from "../api";
import { normalizeBotTools } from "./toolCatalog.jsx";

const SIMPLE_SCHEDULES = [
  { label: "Manual", value: "" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily 9:00", value: "0 9 * * *" },
  { label: "Weekly Mon", value: "0 9 * * 1" },
];

const SIMPLE_SCHEDULE_VALUES = new Set(SIMPLE_SCHEDULES.map((s) => s.value));

const DEFAULT_MAX_RUNTIME = 120;

const hasAdvancedSettings = (bot) => {
  const schedule = bot.schedule || "";
  const model = bot.model || "";
  const tools = bot.tools || [];
  const maxRuntime = bot.max_runtime_seconds;
  const hasCustomSchedule = schedule && !SIMPLE_SCHEDULE_VALUES.has(schedule);
  const hasAdvancedModel = model && !SIMPLE_MODEL_VALUES.has(model);
  const hasAdvancedTools = tools.some((t) => t !== "web_search") || tools.length > 1;
  const hasCustomRuntime = typeof maxRuntime === "number" && maxRuntime !== DEFAULT_MAX_RUNTIME;
  return hasCustomSchedule || hasAdvancedModel || hasAdvancedTools || hasCustomRuntime;
};

export default function EditBotModal({ bot, onClose, onSave }) {
  const [form, setForm] = useState({
    name: bot.name,
    emoji: bot.emoji,
    prompt: bot.prompt,
    model: bot.model,
    tools: normalizeBotTools(bot.tools),
    schedule: bot.schedule || "",
    description: bot.description || "",
    enabled: bot.enabled !== false,
    max_runtime_seconds: bot.max_runtime_seconds || DEFAULT_MAX_RUNTIME,
  });
  const advancedDefaults = hasAdvancedSettings(bot);
  const [advancedOpen, setAdvancedOpen] = useSessionToggle(
    "openclaw.editbot.advanced",
    advancedDefaults,
  );

  useEffect(() => {
    if (advancedDefaults) {
      setAdvancedOpen(true);
    }
  }, [advancedDefaults, setAdvancedOpen]);

  const [emojiOpen, setEmojiOpen] = useState(false);
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const toggleTool = (t) =>
    set("tools", form.tools.includes(t) ? form.tools.filter((x) => x !== t) : [...form.tools, t]);
  const webSearchEnabled = form.tools.includes("web_search");

  const setWebSearch = (enabled) => {
    setForm((prev) => {
      const hasWebSearch = prev.tools.includes("web_search");
      if (enabled && !hasWebSearch) {
        return { ...prev, tools: [...prev.tools, "web_search"] };
      }
      if (!enabled && hasWebSearch) {
        return { ...prev, tools: prev.tools.filter((t) => t !== "web_search") };
      }
      return prev;
    });
  };

  // Load channels and bot-channel links
  const [channels, setChannels] = useState([]);
  const [botChannels, setBotChannels] = useState([]);

  useEffect(() => {
    api.getChannels().then(setChannels).catch(() => {});
    api.getBotChannels(bot.id).then(links => {
      setBotChannels(links);
      // Pre-select the first linked channel in the dropdown
      if (links.length > 0) {
        set('output_channel', links[0].channel_id);
        set('notify_rule', links[0].notify_rule || 'always');
      }
    }).catch(() => {});
  }, [bot.id]);

  const toggleChannel = (channelId) => {
    setBotChannels(prev => {
      const existing = prev.find(c => c.channel_id === channelId);
      if (existing) {return prev.filter(c => c.channel_id !== channelId);}
      return [...prev, { channel_id: channelId, notify_rule: 'always' }];
    });
  };

  const setChannelRule = (channelId, rule) => {
    setBotChannels(prev => prev.map(c => c.channel_id === channelId ? { ...c, notify_rule: rule } : c));
  };

  const simpleModelOptions = SIMPLE_MODEL_VALUES.has(form.model)
    ? SIMPLE_MODELS
    : [...SIMPLE_MODELS, { value: form.model, label: `Advanced: ${form.model}` }];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card animate-scale"
        style={{ maxWidth: 520, padding: 28, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader title="Edit Bot" onClose={onClose} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (form.name && form.prompt) {
              // Save channel link
              const channelLinks = [];
              if (form.output_channel && form.output_channel !== 'none' && !form.output_channel?.startsWith('__')) {
                channelLinks.push({ channel_id: form.output_channel, notify_rule: form.notify_rule || 'always' });
              }
              await api.updateBotChannels(bot.id, channelLinks).catch(() => {});
              const { output_channel, notify_rule, _tg_token, _tg_chat, _webhook_url, ...saveData } = form;
              onSave({ ...saveData, schedule: saveData.schedule || null });
            }
          }}
          className="space-y-5"
          style={{ marginTop: 20 }}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              Bot active
            </span>
            <Toggle active={form.enabled} onChange={() => set("enabled", !form.enabled)} />
          </div>

          {emojiOpen && <EmojiPicker value={form.emoji} onChange={(v) => set("emoji", v)} onClose={() => setEmojiOpen(false)} />}
          <div className="flex gap-3">
            <Field label="Emoji" style={{ width: 72 }}>
              <button type="button" onClick={() => setEmojiOpen(true)}
                className="input-apple"
                style={{ textAlign: "center", padding: "4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", height: 44 }}
              >
                <BotEmoji emoji={form.emoji} name={form.name} size={56} />
              </button>
            </Field>
            <Field label="Name" style={{ flex: 1 }}>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="input-apple"
                required
              />
            </Field>
          </div>

          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="input-apple"
            />
          </Field>

          <Field label="What should it do?">
            <textarea
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
              rows={4}
              className="input-apple"
              required
            />
          </Field>

          <Field label="Model">
            <select
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              className="input-apple"
            >
              {simpleModelOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              Search the web
            </span>
            <Toggle active={webSearchEnabled} onChange={() => setWebSearch(!webSearchEnabled)} />
          </div>

          <Field label="Schedule">
            <div className="flex flex-wrap gap-1.5">
              {SIMPLE_SCHEDULES.map((s) => {
                const active = form.schedule === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set("schedule", s.value)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "1px solid",
                      transition: "all 0.15s ease",
                      background: active ? "var(--accent-soft)" : "transparent",
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      color: active ? "var(--accent)" : "var(--text-tertiary)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <AdvancedSection open={advancedOpen} onToggle={() => setAdvancedOpen((open) => !open)}>
            <div className="space-y-4">
              <Field label="Model (all)">
                <select
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                  className="input-apple"
                >
                  <GroupedModelOptions />
                </select>
              </Field>

              <Field label="Tools">
                <GroupedToolSelector tools={form.tools} onToggle={toggleTool} />
              </Field>

              <Field label="Custom cron">
                <input
                  value={form.schedule}
                  onChange={(e) => set("schedule", e.target.value)}
                  placeholder="*/30 * * * *"
                  className="input-apple"
                  style={{ fontFamily: "SF Mono, Menlo, monospace" }}
                />
              </Field>

              <Field label="Max runtime (seconds)">
                <input
                  type="number"
                  value={form.max_runtime_seconds}
                  onChange={(e) =>
                    set("max_runtime_seconds", parseInt(e.target.value, 10) || DEFAULT_MAX_RUNTIME)
                  }
                  className="input-apple"
                  min={10}
                  max={600}
                />
              </Field>
              <Field label="Output Channel">
                <select value={form.output_channel || 'none'} onChange={e => set('output_channel', e.target.value)} className="input-apple">
                  <option value="none">None — Results only in dashboard</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.type === 'telegram' ? 'Telegram' : ch.type === 'webhook' ? 'Webhook' : ch.type}: {ch.name}</option>
                  ))}
                  <option value="__new_telegram__">+ Add Telegram</option>
                  <option value="__new_webhook__">+ Add Webhook</option>
                </select>

                {form.output_channel === '__new_telegram__' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="input-apple" placeholder="Telegram Bot Token (from @BotFather)"
                      value={form._tg_token || ''} onChange={e => set('_tg_token', e.target.value)}
                      style={{ fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12 }} />
                    <input className="input-apple" placeholder="Chat ID (send /start to your bot, then click Find)"
                      value={form._tg_chat || ''} onChange={e => set('_tg_chat', e.target.value)} />
                    <button type="button" onClick={async () => {
                      if (!form._tg_token) {return;}
                      try {
                        const chat = await api.findTelegramChat(form._tg_token);
                        if (chat?.chat_id) {
                          set('_tg_chat', String(chat.chat_id));
                          const ch = await api.createChannel({ type: 'telegram', name: `Telegram: ${chat.name}`, config: { bot_token: form._tg_token, chat_id: chat.chat_id } });
                          const updated = await api.getChannels();
                          setChannels(updated);
                          const newCh = updated.find(c => c.type === 'telegram');
                          if (newCh) {set('output_channel', newCh.id);}
                        }
                      } catch { alert('No chat found — send your bot a message first.'); }
                    }} className="btn-primary" style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 14px' }}>
                      Find Chat & Connect
                    </button>
                  </div>
                )}

                {form.output_channel === '__new_webhook__' && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input className="input-apple" placeholder="https://example.com/webhook"
                      value={form._webhook_url || ''} onChange={e => set('_webhook_url', e.target.value)} style={{ flex: 1 }} />
                    <button type="button" onClick={async () => {
                      if (!form._webhook_url) {return;}
                      const ch = await api.createChannel({ type: 'webhook', name: 'Webhook', config: { url: form._webhook_url } });
                      const updated = await api.getChannels();
                      setChannels(updated);
                      const newCh = updated.find(c => c.type === 'webhook');
                      if (newCh) {set('output_channel', newCh.id);}
                    }} className="btn-primary" style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                      Save
                    </button>
                  </div>
                )}

                {form.output_channel && form.output_channel !== 'none' && !form.output_channel.startsWith('__') && (
                  <select value={form.notify_rule || 'always'} onChange={e => set('notify_rule', e.target.value)}
                    className="input-apple" style={{ marginTop: 6 }}>
                    <option value="always">Send always</option>
                    <option value="on_new">Only new output</option>
                    <option value="on_error">Only on error</option>
                  </select>
                )}
              </Field>
            </div>
          </AdvancedSection>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, padding: 12 }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, padding: 12 }}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toggle({ active, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        position: "relative",
        background: active ? "var(--success)" : "var(--bg-tertiary)",
        transition: "background 0.2s ease",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "white",
          position: "absolute",
          top: 2,
          left: active ? 22 : 2,
          transition: "left 0.2s ease",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}
