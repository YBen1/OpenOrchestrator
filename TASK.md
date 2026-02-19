# openOrchestrator — MVP Build Task

## What to Build
A **Bot Dashboard** web app where users create, manage, and orchestrate AI bots. NOT a chat interface — it's a mission control center.

## Architecture
- **Backend**: FastAPI (Python) on :8080
- **Frontend**: React + Tailwind on :3000 (Vite)
- **Database**: SQLite via SQLAlchemy
- **Bot Runner**: Subprocess-based, each bot gets own docs folder under /srv/openOrchestrator/bot-data/{bot_id}/
- **Live Updates**: WebSocket for real-time log streaming

## MVP Scope (Phase 1)

### Backend (/srv/openOrchestrator/backend/)
1. **FastAPI app** with CORS, WebSocket support
2. **Models**: Bot, Run, Result, Trigger (SQLite + SQLAlchemy)
3. **Bot CRUD**: POST/GET/PUT/DELETE /api/bots
4. **Bot Runner**: POST /api/bots/{id}/run — spawns subprocess, streams output via WebSocket
5. **Run History**: GET /api/bots/{id}/runs
6. **Triggers**: POST /api/triggers — "when bot A completes, start bot B"
7. **Schedule**: Simple cron-like scheduling (APScheduler)
8. **Bot Docs**: GET/POST /api/bots/{id}/docs — file management per bot

### Frontend (/srv/openOrchestrator/frontend/)
1. **Dashboard page**: Grid of bot cards with live status (🟢 Running / ⏸️ Paused / 🔴 Stopped)
2. **Bot card**: Name, emoji, description, last run time, result count, Run/Log buttons
3. **New Bot modal**: Name, emoji, description (prompt), model selector, schedule, tools checkboxes
4. **Bot detail page**: Stats, results feed, docs list, live log stream
5. **Triggers section**: Show connections between bots (Bot A → Bot B)
6. **Activity feed**: Bottom of dashboard, last 20 events across all bots
7. **Dark theme** by default, clean modern UI

### Bot Runner Logic
```python
# Each bot run:
# 1. Create Run record (status=running)
# 2. Spawn subprocess that calls LLM API with bot's prompt
# 3. Stream stdout to WebSocket
# 4. Save output as Result
# 5. Update Run (status=completed/failed)
# 6. Check triggers → start next bot if configured
# 7. Bot can read/write files in its own docs folder
```

### Data Model
```sql
bots: id, name, emoji, description, prompt, model, tools(JSON), schedule, docs_path, notify(JSON), created_at, updated_at
triggers: id, source_bot, event, target_bot, target_action, enabled
runs: id, bot_id, trigger, status, input, output, log, started_at, finished_at, duration_ms
results: id, bot_id, run_id, title, content, url, metadata(JSON), pinned, created_at
```

## Important
- Keep it SIMPLE. No auth for MVP (localhost only).
- Use actual OpenAI/Anthropic API for bot runs (check env vars OPENAI_API_KEY, ANTHROPIC_API_KEY)
- If no API key, use a mock/echo bot for testing
- Make it look GOOD — this is a product, not a prototype
- Use Docker Compose for easy startup (backend + frontend)
- Git commit regularly with meaningful messages

## DO NOT
- Don't touch the existing OpenClaw source files (upstream/)
- Don't add authentication (MVP is localhost only)
- Don't over-engineer — ship fast, iterate later
