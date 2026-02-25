// Shared model catalog — grouped by provider

export const SIMPLE_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (fast & cheap)" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gpt-5-nano", label: "GPT-5 Nano (fast)" },
  { value: "gpt-5-mini", label: "GPT-5 Mini" },
  { value: "mistral-small-latest", label: "Mistral Small" },
];

export const SIMPLE_MODEL_VALUES = new Set(SIMPLE_MODELS.map((m) => m.value));

export const MODEL_GROUPS = [
  {
    provider: "OpenAI",
    models: [
      // GPT-5 family
      { value: "gpt-5.2", label: "GPT-5.2 (best)" },
      { value: "gpt-5.1", label: "GPT-5.1" },
      { value: "gpt-5", label: "GPT-5" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5-nano", label: "GPT-5 Nano (fastest)" },
      { value: "gpt-5-pro", label: "GPT-5 Pro (max quality)" },
      { value: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
      // GPT-4.1 family
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      // GPT-4o family
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      // Reasoning (o-series)
      { value: "o3", label: "o3 (reasoning)" },
      { value: "o3-mini", label: "o3-mini (reasoning)" },
      { value: "o4-mini", label: "o4-mini (reasoning)" },
      { value: "o3-pro", label: "o3-pro (max reasoning)" },
      // Search
      { value: "gpt-4o-search-preview", label: "GPT-4o Search" },
      { value: "gpt-4o-mini-search-preview", label: "GPT-4o Mini Search" },
      // Codex (coding)
      { value: "gpt-5.3-codex", label: "GPT-5.3 Codex (coding)" },
      { value: "gpt-5.2-codex", label: "GPT-5.2 Codex (coding)" },
      { value: "gpt-5.1-codex", label: "GPT-5.1 Codex (coding)" },
    ],
  },
  {
    provider: "Anthropic",
    models: [
      { value: "claude-opus-4-20250514", label: "Claude Opus 4 (best)" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-haiku-4-20250414", label: "Claude Haiku 4 (fast)" },
    ],
  },
  {
    provider: "Google",
    models: [
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  {
    provider: "Mistral",
    models: [
      { value: "mistral-large-latest", label: "Mistral Large" },
      { value: "mistral-small-latest", label: "Mistral Small" },
      { value: "codestral-latest", label: "Codestral" },
    ],
  },
  {
    provider: "Ollama (local)",
    models: [
      { value: "ollama/llama3.3", label: "Llama 3.3" },
      { value: "ollama/mistral", label: "Mistral" },
      { value: "ollama/phi4", label: "Phi-4" },
      { value: "ollama/qwen2.5", label: "Qwen 2.5" },
    ],
  },
];

// Flat list for lookups
export const FULL_MODELS = MODEL_GROUPS.flatMap((g) => g.models);
export const FULL_MODEL_VALUES = new Set(FULL_MODELS.map((m) => m.value));

// Render grouped <optgroup> options
export function GroupedModelOptions() {
  return MODEL_GROUPS.map((g) => (
    <optgroup key={g.provider} label={g.provider}>
      {g.models.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </optgroup>
  ));
}
