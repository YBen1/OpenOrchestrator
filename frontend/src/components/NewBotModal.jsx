import { X, Search, Globe, Code, FolderOpen, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { SIMPLE_MODELS, SIMPLE_MODEL_VALUES, GroupedModelOptions } from "./modelCatalog.jsx";

const SIMPLE_SCHEDULES = [
  { label: "Manual", value: "" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily 9:00", value: "0 9 * * *" },
  { label: "Weekly Mon", value: "0 9 * * 1" },
];

const TOOL_ICONS = {
  web_search: <Search size={14} strokeWidth={2} />,
  browser: <Globe size={14} strokeWidth={2} />,
  code: <Code size={14} strokeWidth={2} />,
  files: <FolderOpen size={14} strokeWidth={2} />,
};

const TOOLS = [
  { value: "web_search", label: "Web Search" },
  { value: "browser", label: "Browser" },
  { value: "code", label: "Code" },
  { value: "files", label: "Files" },
];

const DEFAULT_MAX_RUNTIME = 120;

export function useSessionToggle(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    const stored = sessionStorage.getItem(key);
    if (stored === null) {
      return initialValue;
    }
    return stored === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    sessionStorage.setItem(key, value ? "1" : "0");
  }, [key, value]);

  return [value, setValue];
}

export default function NewBotModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "",
    emoji: "🤖",
    prompt: "",
    model: "gpt-4o-mini",
    tools: [],
    schedule: "",
    description: "",
    max_runtime_seconds: DEFAULT_MAX_RUNTIME,
  });
  const [advancedOpen, setAdvancedOpen] = useSessionToggle("openclaw.newbot.advanced", false);

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

  const simpleModelOptions = SIMPLE_MODEL_VALUES.has(form.model)
    ? SIMPLE_MODELS
    : [...SIMPLE_MODELS, { value: form.model, label: `Advanced: ${form.model}` }];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card animate-scale"
        style={{ maxWidth: 480, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader title="New Bot" onClose={onClose} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (form.name && form.prompt) {
              onCreate({
                ...form,
                description: form.description || form.prompt.slice(0, 100),
                schedule: form.schedule || null,
              });
            }
          }}
          className="space-y-5"
          style={{ marginTop: 20 }}
        >
          <div className="flex gap-3">
            <Field label="Emoji" style={{ width: 72 }}>
              <input
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                className="input-apple"
                style={{ textAlign: "center", fontSize: 20, padding: "8px" }}
              />
            </Field>
            <Field label="Name" style={{ flex: 1 }}>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="eBay-Scout"
                className="input-apple"
                required
              />
            </Field>
          </div>

          <Field label="What should it do?">
            <textarea
              value={form.prompt}
              onChange={(e) => set("prompt", e.target.value)}
              rows={3}
              placeholder="Search eBay for Nike Air Max under $50..."
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
              <Field label="Description">
                <input
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Short description..."
                  className="input-apple"
                />
              </Field>

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
                <div className="flex flex-wrap gap-2">
                  {TOOLS.map((t) => (
                    <ToolChip
                      key={t.value}
                      label={t.label}
                      icon={TOOL_ICONS[t.value]}
                      active={form.tools.includes(t.value)}
                      onClick={() => toggleTool(t.value)}
                    />
                  ))}
                </div>
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
              Create Bot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between">
      <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h2>
      <button
        onClick={onClose}
        className="btn-ghost"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function ToolChip({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        border: "1px solid",
        transition: "all 0.15s ease",
        background: active ? "var(--accent-soft)" : "var(--bg-tertiary)",
        borderColor: active ? "var(--accent)" : "var(--border)",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function AdvancedSection({ title = "Advanced Settings", open, onToggle, children }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--bg-tertiary)",
        padding: 12,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          {title}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          style={{
            color: "var(--text-tertiary)",
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      <div
        style={{
          maxHeight: open ? 700 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s ease, opacity 0.2s ease",
        }}
      >
        <div style={{ paddingTop: open ? 12 : 0 }}>{children}</div>
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
