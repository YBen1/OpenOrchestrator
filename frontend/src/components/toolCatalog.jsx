import { Terminal, Globe, Layout, Sparkles, MessageSquare, Zap, Brain, Server } from 'lucide-react';

export const TOOL_GROUPS = [
  {
    id: 'core',
    label: 'Core',
    icon: <Terminal size={14} />,
    tools: [
      { value: 'exec', label: 'Shell', desc: 'Run shell commands' },
      { value: 'read_file', label: 'Read', desc: 'Read files' },
      { value: 'write_file', label: 'Write', desc: 'Create/overwrite files' },
      { value: 'edit', label: 'Edit', desc: 'Precise text edits' },
      { value: 'process', label: 'Process', desc: 'Background exec management' },
      { value: 'apply_patch', label: 'Patch', desc: 'Apply unified diffs' },
    ],
  },
  {
    id: 'web',
    label: 'Web',
    icon: <Globe size={14} />,
    tools: [
      { value: 'web_search', label: 'Web Search', desc: 'Brave Search API', needsKey: 'brave' },
      { value: 'web_fetch', label: 'Web Fetch', desc: 'URL → markdown' },
    ],
  },
  {
    id: 'browser',
    label: 'Browser',
    icon: <Layout size={14} />,
    tools: [
      { value: 'browser', label: 'Browser', desc: 'Full Playwright control' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Sparkles size={14} />,
    tools: [
      { value: 'image', label: 'Vision', desc: 'Image analysis' },
      { value: 'tts', label: 'TTS', desc: 'Text-to-speech', needsKey: 'openai' },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: <Brain size={14} />,
    tools: [
      { value: 'memory_search', label: 'Search', desc: 'Search bot memory' },
      { value: 'memory_get', label: 'Read', desc: 'Read memory files' },
    ],
  },
  {
    id: 'communication',
    label: 'Messaging',
    icon: <MessageSquare size={14} />,
    tools: [
      { value: 'message', label: 'Message', desc: 'Telegram, Discord, etc.' },
    ],
  },
  {
    id: 'gateway',
    label: 'Gateway',
    icon: <Server size={14} />,
    tools: [
      { value: 'cron', label: 'Cron', desc: 'Scheduling & reminders' },
      { value: 'sessions_spawn', label: 'Sub-Agents', desc: 'Spawn background agents' },
      { value: 'subagents', label: 'Orchestrate', desc: 'List/steer sub-agents' },
      { value: 'sessions_list', label: 'Sessions', desc: 'List active sessions' },
      { value: 'sessions_send', label: 'Send', desc: 'Message another session' },
      { value: 'nodes', label: 'Nodes', desc: 'Control paired devices' },
      { value: 'canvas', label: 'Canvas', desc: 'UI rendering & control' },
    ],
  },
];

// Flat list of all tool values
export const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.tools);
export const ALL_TOOL_VALUES = ALL_TOOLS.map(t => t.value);

// Legacy mapping for backwards compat (old tool names → new)
export const LEGACY_TOOL_MAP = {
  code: 'exec',
  files: 'write_file',
  read: 'read_file',
  write: 'write_file',
};

export function normalizeBotTools(tools) {
  if (!tools) {return [];}
  return tools.map(t => LEGACY_TOOL_MAP[t] || t).filter(t => ALL_TOOL_VALUES.includes(t));
}
