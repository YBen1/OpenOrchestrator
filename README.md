# 🎛️ openOrchestrator

Bot Dashboard — Erstelle, verwalte und orchestriere AI-Bots über ein modernes Web-Interface.

## Features

- **Bot CRUD** — Bots anlegen, bearbeiten, löschen
- **One-Click Run** — Bots manuell starten, Output live streamen
- **Live Logs** — WebSocket-basierte Echtzeit-Logs
- **Trigger System** — Bot A fertig → Bot B startet automatisch
- **Ergebnis-Feed** — Alle Bot-Outputs übersichtlich
- **Dokumente** — Jeder Bot hat seinen eigenen Docs-Ordner
- **Activity Feed** — Letzte 20 Events auf einen Blick
- **Dark Theme** — Modernes, cleanes Dashboard

## Quick Start

### Mit Docker Compose

```bash
# Optional: API Keys setzen
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...

# Starten
docker compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8080/docs
```

### Ohne Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend   | FastAPI + SQLAlchemy + SQLite |
| Frontend  | React + Vite + Tailwind CSS |
| Live Updates | WebSocket |
| Bot Runner | Async subprocess, OpenAI/Anthropic API |
| Deployment | Docker Compose |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bots` | Alle Bots auflisten |
| POST | `/api/bots` | Neuen Bot anlegen |
| GET | `/api/bots/:id` | Bot Details |
| PUT | `/api/bots/:id` | Bot bearbeiten |
| DELETE | `/api/bots/:id` | Bot löschen |
| POST | `/api/bots/:id/run` | Bot starten |
| GET | `/api/bots/:id/runs` | Run History |
| GET | `/api/bots/:id/results` | Ergebnisse |
| GET | `/api/bots/:id/docs` | Bot-Dokumente |
| POST | `/api/bots/:id/docs` | Dokument hochladen |
| GET | `/api/activity` | Activity Feed |
| GET/POST/DELETE | `/api/triggers` | Trigger verwalten |
| WS | `/ws/bots/:id` | Live Log Stream |

## Lizenz

MIT
