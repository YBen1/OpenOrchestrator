# openOrchestrator — Architecture

## Vision
Desktop app for non-technical users to create and run AI bots with full OpenClaw capabilities.
No terminal, no YAML, no Docker. Install → open browser → build bots.

## Architecture: Option B — OpenClaw TypeScript Engine via HTTP API

```
┌─────────────────────────────────────────────┐
│            React Frontend (UI)               │
│  Bot Builder · Emoji Picker · Channels       │
│  Tool Config · Run Viewer · Scheduling       │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│         Python FastAPI (Orchestrator)        │
│  Auth · Bot CRUD · Scheduling · Run History  │
│  Channel Config · API Key Management         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  When bot runs:                              │
│    → POST http://localhost:18810/agent/run   │
│    → Streams SSE events back                 │
│    → Stores result in SQLite                 │
└──────────────────┬──────────────────────────┘
                   │ HTTP (localhost:18810)
┌──────────────────▼──────────────────────────┐
│      OpenClaw Agent Runner Server (TS)       │
│  Express HTTP on :18810                      │
│  pi-ai LLM Engine · Tool Loop · Compaction   │
│  ┌─────────────────────────────────────┐     │
│  │ ALL TOOLS:                          │     │
│  │                                     │     │
│  │ ── Core ──                          │     │
│  │ exec (shell)    process (bg mgmt)   │     │
│  │ read/write/edit (files)             │     │
│  │ apply_patch (multi-hunk edits)      │     │
│  │                                     │     │
│  │ ── Web ──                           │     │
│  │ web_search (Brave API)              │     │
│  │ web_fetch (URL → markdown)          │     │
│  │ browser (Playwright, full control)  │     │
│  │                                     │     │
│  │ ── AI ──                            │     │
│  │ image (vision/analysis)             │     │
│  │ tts (text-to-speech)                │     │
│  │ memory_search / memory_get          │     │
│  │                                     │     │
│  │ ── Communication ──                 │     │
│  │ message (Telegram/Discord/Slack/    │     │
│  │         WhatsApp/Signal/iMessage)   │     │
│  │ cron (scheduling + reminders)       │     │
│  │                                     │     │
│  │ ── Advanced ──                      │     │
│  │ sessions (list/history/send/spawn)  │     │
│  │ subagents (orchestration)           │     │
│  │ canvas (UI rendering)              │     │
│  │ nodes (device control)             │     │
│  │ gateway (self-management)          │     │
│  └─────────────────────────────────────┘     │
│  Also: Context Compaction, Tool-Loop         │
│  Detection, Model Failover, Auto-Retry       │
└──────────────────────────────────────────────┘
```

## What stays in Python
- **Auth**: Password login, session management
- **Bot CRUD**: Create/edit/delete bots, SQLite storage
- **Scheduling**: APScheduler (cron, interval triggers)
- **Run History**: Track runs, logs, token usage, costs
- **Channel Config**: Setup wizards for Telegram, Discord, etc.
- **API Key Management**: Store/encrypt provider keys
- **UI API**: Everything the React frontend needs

## What moves to TypeScript (OpenClaw Engine)
- **LLM Calls**: All provider communication via pi-ai
- **Tool Execution**: All 25+ tools from OpenClaw core
- **Context Management**: Compaction, token limits, history
- **Tool Loop Detection**: Anti-loop guardrails
- **Model Failover**: Automatic provider switching
- **System Prompt Building**: Skills, memory, workspace injection

## Tool Inventory (Full OpenClaw Feature Set)

### Group: Core (group:fs + group:runtime)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `exec` | Run shell commands, bg support, PTY | No |
| `process` | Manage background exec sessions | No |
| `read` | Read file contents | No |
| `write` | Create/overwrite files | No |
| `edit` | Precise text replacement in files | No |
| `apply_patch` | Multi-hunk structured patches | No |

### Group: Web (group:web)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `web_search` | Brave Search API (needs API key) | No |
| `web_fetch` | URL → markdown/text extraction | No |

### Group: Browser (group:ui)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `browser` | Full Playwright browser control | No (standalone Express server) |
| `canvas` | Node Canvas rendering + A2UI | Yes (gateway → node) |

### Group: AI
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `image` | Vision/image analysis | No |
| `tts` | Text-to-speech | No |

### Group: Memory (group:memory)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `memory_search` | Semantic search over memory files | No |
| `memory_get` | Read specific memory snippets | No |

### Group: Communication (group:messaging)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `message` | Send/edit/delete/react across channels | Partial (WhatsApp needs gateway) |

### Group: Automation (group:automation)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `cron` | Schedule jobs, reminders, wake events | Yes |
| `gateway` | Restart, config, update management | Yes |

### Group: Sessions (group:sessions)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `sessions_list` | List active sessions | Yes |
| `sessions_history` | Fetch session transcripts | Yes |
| `sessions_send` | Send message to another session | Yes |
| `sessions_spawn` | Start sub-agent in background | Yes |
| `session_status` | Usage/cost/model info | Yes |
| `agents_list` | List available agent IDs | Yes |
| `subagents` | List/steer/kill sub-agents | Yes |

### Group: Nodes (group:nodes)
| Tool | Description | Gateway needed |
|------|-------------|----------------|
| `nodes` | Device discovery, camera, screen, run | Yes |

## Engine Features (beyond tools)
| Feature | Description |
|---------|-------------|
| **pi-ai LLM Runner** | Multi-provider (OpenAI, Anthropic, Google, Mistral, Ollama, etc.) |
| **Context Compaction** | Automatic token limit management |
| **Tool Loop Detection** | Anti-loop guardrails (repeat, ping-pong) |
| **Model Failover** | Auto-switch on provider errors |
| **Model Catalog** | Full model discovery + pricing |
| **System Prompt Builder** | Skills, memory, workspace injection |
| **API Key Rotation** | Multi-key support per provider |
| **Auth Profiles** | Named auth configurations |

## Migration Steps

### Step 1: Agent Runner Server (NEW)
Create `src/agent-runner-server.ts`:
- Express HTTP server on `:18810`
- `POST /agent/run` — start an agent run
  - Input: `{ prompt, tools[], model, input, maxTimeSeconds, apiKeys: {} }`
  - Output: SSE stream with events:
    - `tool_call` (name, args)
    - `tool_result` (output)
    - `progress` (partial text)
    - `complete` (final output, tokens, cost)
    - `error` (message)
- `GET /agent/status/:runId` — check run status
- `GET /tools` — list available tools
- `GET /models` — list available models
- Uses pi-embedded-runner.ts for actual LLM execution
- Uses all existing tool implementations from src/agents/tools/

### Step 2: Python Bridge
Create `backend/engine.py`:
- `async def run_agent(prompt, tools, model, input, api_keys, timeout)` 
- Connects to localhost:18810 via SSE
- Yields events for live UI updates
- Returns final result for DB storage

Update `backend/bot_runner.py`:
- Replace direct OpenAI/Anthropic calls with engine.run_agent()
- Pass bot.tools config + user's API keys
- Stream events to run log

### Step 3: Tool Config UI
Frontend Settings page:
- API Keys section (OpenAI, Anthropic, Google, Brave, ElevenLabs)
- Per-bot tool selection with checkboxes (grouped)
- Tool groups: Core, Web, Browser, AI, Communication, Advanced
- Visual indicator which tools need API keys

### Step 4: Cleanup
- Remove `backend/tools.py` (Python tool implementations)
- Remove Python LLM provider code
- Keep: auth, bot CRUD, scheduling, run history, channel config

## Key Decisions
- **Port 18810** for Agent Runner (18800 = browser, 18789 = gateway)
- **SSE streaming** (not WebSocket) — simpler, HTTP-native
- **API keys passed per-request** — no config files on TS side
- **Python stays for orchestration** — auth, DB, scheduling, UI API
- **TypeScript handles AI** — LLM, tools, context, everything smart
