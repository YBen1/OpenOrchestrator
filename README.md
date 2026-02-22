<p align="center">
  <img src="frontend/public/logo-sm.png" width="120" alt="openOrchestrator">
</p>

<h1 align="center">openOrchestrator</h1>

<p align="center">
  <strong>Your AI Bots. Your Computer.</strong><br>
  Create powerful AI bots without writing a single line of code.<br>
  Runs locally — private, fast, and free.
</p>

<p align="center">
  <a href="https://openorch.ai">Website</a> ·
  <a href="https://app.openorch.ai">Live Demo</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#features">Features</a>
</p>

---

## What is openOrchestrator?

openOrchestrator is a local-first AI bot platform. You describe what a bot should do in plain language, pick an AI model, and let it run — on a schedule, in a pipeline, or on demand. Results come to you via Telegram, webhook, or the built-in dashboard.

No cloud subscription. No coding. Your API keys, your data, your machine.

## Features

- **Bot Builder** — Create bots in seconds with templates or from scratch
- **Any AI Model** — OpenAI, Anthropic, Google, Mistral, or local models via Ollama
- **Tools** — Web search, file I/O, code execution, URL fetching
- **Scheduling** — Cron-based scheduling with jitter and concurrency limits
- **Pipelines** — Chain bots into workflows (output → input)
- **Channels** — Get results via Telegram, webhooks, or email
- **Credentials** — Securely store API keys and tokens for your bots
- **Token Tracking** — Per-bot usage and cost estimation
- **Dark & Light Mode** — Premium dark-first UI with red accent
- **Keyboard Shortcuts** — ⌘K search, ⌘N new bot, ⌘, settings
- **100% Local** — SQLite database, no external services required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python · FastAPI · SQLAlchemy · SQLite |
| Frontend | React · Vite · Tailwind CSS · Lucide Icons |
| LLM | OpenAI · Anthropic · Google · Mistral · Ollama |
| Scheduling | APScheduler |
| Channels | Telegram Bot API · Webhooks · SMTP |

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- An API key from any supported provider (or Ollama for local models)

### Install

```bash
git clone https://github.com/YBen1/OpenOrchestrator.git
cd OpenOrchestrator

# Backend
pip install -r requirements.txt
cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8080 &

# Frontend
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), set a master password, add an API key, and create your first bot.

### Docker (coming soon)

```bash
docker run -d -p 8080:8080 -v openorch-data:/data ghcr.io/yben1/openorchestrator
```

## Screenshots

*Coming soon*

## Project Structure

```
├── backend/            # FastAPI backend
│   ├── main.py         # App entry, routes, WebSocket
│   ├── bot_runner.py   # LLM execution engine + tool loop
│   ├── tools.py        # Web search, files, code exec, browser
│   ├── channels.py     # Telegram, webhook, email
│   ├── models.py       # SQLAlchemy models
│   ├── scheduler.py    # APScheduler integration
│   ├── templates.py    # Bot templates
│   └── routers/        # Settings, channels, pipelines, auth
├── frontend/           # React + Vite frontend
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/ # Dashboard, BotCard, Modals, Settings...
├── landing/            # Landing page (openorch.ai)
├── PACKAGING.md        # Packaging roadmap (Docker, Electron)
└── requirements.txt    # Python dependencies
```

## Roadmap

- [x] Bot creation, editing, templates
- [x] Multi-provider LLM runner with tool loop
- [x] Web search, file I/O, code execution tools
- [x] Scheduling (cron, manual, triggers)
- [x] Pipeline builder
- [x] Telegram & webhook channels
- [x] Token tracking & cost estimation
- [x] Dark/red premium theme
- [ ] Docker image
- [ ] Electron desktop app (macOS, Windows, Linux)
- [ ] Browser automation tool (Playwright)
- [ ] Plugin system for custom tools

## License

MIT

---

<p align="center">
  Made in Germany
</p>
