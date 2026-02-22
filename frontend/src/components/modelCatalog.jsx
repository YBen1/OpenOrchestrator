// Shared model catalog — grouped by provider

export const SIMPLE_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (fast)" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet" },
  { value: "gemini-2.0-flash", label: "Gemini Flash" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "mistral-small-latest", label: "Mistral Small" },
];

export const SIMPLE_MODEL_VALUES = new Set(SIMPLE_MODELS.map((m) => m.value));

export const MODEL_GROUPS = [
  {
    provider: "OpenAI",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5", label: "GPT-5" },
      { value: "o3-mini", label: "o3-mini (reasoning)" },
      { value: "o4-mini", label: "o4-mini (reasoning)" },
    ],
  },
  {
    provider: "Anthropic",
    models: [
      { value: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    ],
  },
  {
    provider: "Google",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
  {
    provider: "Mistral",
    models: [
      { value: "mistral-small-latest", label: "Mistral Small" },
      { value: "mistral-large-latest", label: "Mistral Large" },
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
