# openOrchestrator — Backlog (v2, refined)

---

## A. WIEDERKEHRENDE BOTS (Scheduling & Persistenz)

**Konzept:** Bot mit Schedule läuft automatisch, speichert jedes Ergebnis in der App, benachrichtigt optional per Channel.

```
┌─────────────────────────────────────────────────────────┐
│  🛒 eBay-Scout                       ⏰ Jede Stunde     │
│                                                          │
│  Ergebnisse:                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 14:00  ✅ 3 neue Treffer                           │  │
│  │ 13:00  ✅ Keine neuen Angebote                     │  │
│  │ 12:00  ✅ 1 neuer Treffer: Nike AM90 — 35€        │  │
│  │ 11:00  ❌ Timeout (eBay nicht erreichbar)          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Benachrichtigen via:                                    │
│  ☑️ App (immer)  ☑️ Telegram  ☐ E-Mail                  │
│  Regel: ○ Immer  ● Nur bei neuen Ergebnissen  ○ Nie    │
└─────────────────────────────────────────────────────────┘
```

### Backend-Aufbau

**Scheduler:**
- **APScheduler** (AsyncIOScheduler) als In-Process-Scheduler
- Beim App-Start: alle Bots mit `schedule IS NOT NULL AND enabled = TRUE` laden → Jobs registrieren
- Bei Bot-Update (Schedule geändert): Job live updaten/entfernen
- Persistenz: APScheduler JobStore auf SQLite (gleiche DB), damit nach Neustart keine Runs verpasst werden
- **Missed Runs**: Wenn App aus war → beim Start prüfen ob Runs verpasst wurden. Konfigurierbar: nachholen (max 1) oder ignorieren. Default: ignorieren — ein Scout der 3h aus war soll nicht 3x hintereinander laufen.

**Run-Lifecycle:**
```
PENDING → RUNNING → COMPLETED | FAILED | CANCELLED | TIMEOUT
```
- `PENDING`: Scheduler hat Run erstellt, wartet auf freien Slot
- `RUNNING`: LLM-Call aktiv
- `TIMEOUT`: Harter Kill nach `max_runtime_seconds` (default: 120s, konfigurierbar pro Bot)
- Jeder Run speichert: input, output, log, status, started_at, finished_at, duration_ms, **tokens_used**, **cost_estimate**, **error_message**

**Bot-Memory (Kontext zwischen Runs):**
```python
# Was der Bot bei jedem Run als Context bekommt:
system_prompt = f"""Du bist {bot.name}. {bot.description}

Dein letztes Ergebnis ({last_run.finished_at}):
{last_run.output[:2000]}

Deine gespeicherten Notizen:
{bot_docs_content[:4000]}

Aktuelle Aufgabe:
{bot.prompt}
"""
```
- **Diff-Detection**: Hash des Outputs speichern. `output_hash != last_output_hash` → "neue Ergebnisse"
- **Docs-Ordner**: `/data/bots/{bot_id}/` — Bot kann dort Dateien ablegen (via Tool), werden beim nächsten Run als Context geladen
- **Context-Window-Management**: Wenn Docs > 4000 Tokens → nur die neuesten / relevantesten laden. Später: Embedding-basiertes Retrieval.

**Concurrency & Limits:**
- **Max parallele Runs**: Default 3 (konfigurierbar in Settings). Darüber hinaus: Queue (FIFO).
- **Run-Queue**: `asyncio.Queue` mit Worker-Pool. Runs warten in PENDING bis Slot frei.
- **Retry**: 1x nach 30s bei transientem Fehler (HTTP 429, 500, Timeout). Kein Retry bei 401 (Key ungültig) oder inhaltlichem Fehler.
- **Backpressure**: Wenn Queue > 10 → Warnung im Dashboard. Wenn Queue > 20 → neue Scheduled-Runs droppen mit Log-Eintrag.

**Notification-Filter:**
| Regel | Logik |
|-------|-------|
| `always` | Jeden Run melden |
| `on_new` | Nur wenn `output_hash` sich geändert hat |
| `on_results` | Nur wenn Output nicht leer / nicht "keine Ergebnisse" |
| `on_error` | Nur bei Status `failed` oder `timeout` |
| `never` | Nur im Dashboard |

**Quiet Hours:**
- Global in Settings: "Keine Benachrichtigungen zwischen 23:00–07:00" (nur Channel-Notifications, App-intern wird immer gespeichert)
- Runs laufen trotzdem — nur die Benachrichtigung wird zurückgehalten und beim nächsten erlaubten Zeitfenster als Batch gesendet

---

## B. PIPELINE-BUILDER (Bot-Ketten)

**Konzept:** User verbindet Bots zu einer Pipeline. Output von Bot A wird Input für Bot B.

```
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │ 📝 Texter │──────▶│ 🔍 Prüfer │──────▶│ 📧 Sender │
  │           │       │           │       │           │
  │ "Schreib  │       │ "Check    │       │ "Schick   │
  │  Newsletter│      │  Grammatik│       │  per Mail" │
  └──────────┘       └──────────┘       └──────────┘
       ⏰ Mo 9:00          auto              auto
```

### Datenmodell

```sql
CREATE TABLE pipelines (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    schedule      TEXT,              -- Cron für den ersten Schritt
    enabled       BOOLEAN DEFAULT 1,
    error_policy  TEXT DEFAULT 'abort', -- 'abort' | 'skip' | 'retry'
    created_at    DATETIME,
    updated_at    DATETIME
);

CREATE TABLE pipeline_steps (
    id            TEXT PRIMARY KEY,
    pipeline_id   TEXT REFERENCES pipelines(id) ON DELETE CASCADE,
    bot_id        TEXT REFERENCES bots(id),
    step_order    INTEGER NOT NULL,
    input_mode    TEXT DEFAULT 'forward', -- 'forward' (prev output) | 'merge' (prev output + bot prompt) | 'independent'
    condition     TEXT,              -- Optional: JSON-Bedingung wann Step ausgeführt wird
    UNIQUE(pipeline_id, step_order)
);

CREATE TABLE pipeline_runs (
    id            TEXT PRIMARY KEY,
    pipeline_id   TEXT REFERENCES pipelines(id),
    status        TEXT DEFAULT 'running', -- running | completed | failed | cancelled
    current_step  INTEGER,
    started_at    DATETIME,
    finished_at   DATETIME
);
```

### Output-Forwarding — wie genau?

**Drei Modi (wählbar pro Pipeline-Step):**

1. **`forward`** (default): Output von Step N wird als User-Message an Step N+1 übergeben
   ```python
   messages = [
       {"role": "system", "content": f"Du bist {bot.name}. {bot.description}"},
       {"role": "user", "content": f"Vorheriger Schritt hat folgendes Ergebnis geliefert:\n\n{prev_output}\n\nDeine Aufgabe: {bot.prompt}"}
   ]
   ```

2. **`merge`**: Bot-Prompt + vorheriger Output werden zusammengeführt
   ```python
   messages = [
       {"role": "system", "content": f"Du bist {bot.name}. {bot.description}\n\nKontext vom vorherigen Schritt:\n{prev_output}"},
       {"role": "user", "content": bot.prompt}
   ]
   ```

3. **`independent`**: Bot läuft mit eigenem Prompt, ignoriert vorherigen Output (für parallele Schritte oder Side-Effects wie "sende Mail")

**Fehler-Handling pro Pipeline:**
| Policy | Verhalten |
|--------|-----------|
| `abort` | Pipeline stoppt, Status = `failed`, nachfolgende Steps werden nicht ausgeführt |
| `skip` | Fehlerhafter Step wird übersprungen, nächster Step bekommt leeren Input |
| `retry` | 1x Retry nach 30s, dann abort |

**GUI — Pipeline-Editor:**
```
┌──────────────────────────────────────────────────────┐
│  Pipeline: "Newsletter-Workflow"         [⏰ Mo 9:00] │
│                                                        │
│  ┌─ Schritt 1 ────────────────────────────────────┐   │
│  │ [📝 Texter ▾]  Modus: [🔀 Eigenständig ▾]     │   │
│  └────────────────────────────────────────────────┘   │
│      ↓ Output weiterleiten                            │
│  ┌─ Schritt 2 ────────────────────────────────────┐   │
│  │ [🔍 Prüfer ▾]  Modus: [➡️ Output übernehmen ▾]│   │
│  └────────────────────────────────────────────────┘   │
│      ↓ Output weiterleiten                            │
│  ┌─ Schritt 3 ────────────────────────────────────┐   │
│  │ [📧 Sender ▾]  Modus: [➡️ Output übernehmen ▾]│   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  Bei Fehler: [● Abbrechen ○ Überspringen ○ Retry]    │
│                                                        │
│  [+ Schritt hinzufügen]        [Pipeline speichern]   │
└──────────────────────────────────────────────────────┘
```

**Spätere Erweiterung: Branching**
- Bedingter Pfad: "Wenn Prüfer 'Fehler gefunden' sagt → zurück an Texter"
- Parallele Steps: Step 2a + 2b gleichzeitig, Step 3 wartet auf beide
- Erstmal NICHT bauen. Lineare Pipelines decken 90% der Use Cases ab. Branching ist ein Rabbit Hole.

---

## C. API-KEY ONBOARDING

### Geführter Wizard

```
┌──────────────────────────────────────────────────────────┐
│  🔑 KI-Anbieter verbinden                                │
│                                                            │
│  Deine Bots brauchen eine KI um zu denken.                │
│  Wähle einen Anbieter und folge der Anleitung:            │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  ✨ OpenAI    │  │  🟣 Anthropic │  │  🔵 Google   │      │
│  │  GPT-5, 4.1  │  │  Claude      │  │  Gemini      │      │
│  │              │  │              │  │              │      │
│  │  ab ~$5/Mo   │  │  ab ~$5/Mo   │  │  Gratis-Tier │      │
│  │  [Einrichten]│  │  [Einrichten]│  │  [Einrichten]│      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐                        │
│  │  🟠 Mistral  │  │  🏠 Lokal     │                        │
│  │  Europäisch  │  │  Ollama      │                        │
│  │              │  │              │                        │
│  │  ab ~$2/Mo   │  │  Kostenlos   │                        │
│  │  [Einrichten]│  │  [Einrichten]│                        │
│  └─────────────┘  └─────────────┘                        │
└──────────────────────────────────────────────────────────┘
```

### Pro-Provider Wizard-Details

**OpenAI:**
1. Account: `platform.openai.com/signup` [Link öffnen ↗]
2. Billing: Settings → Billing → Add payment method [Link öffnen ↗]
3. Key: Settings → API Keys → Create new key [Link öffnen ↗]
4. Key einfügen → [Testen & Speichern]
5. Validierung: Test-Call (`gpt-4.1-nano`, 10 Tokens) → zeigt verfügbare Modelle

**Anthropic:**
1. Account: `console.anthropic.com` [Link öffnen ↗]
2. Billing: Settings → Plans & Billing [Link öffnen ↗]
3. Key: Settings → API Keys [Link öffnen ↗]
4. Key einfügen → [Testen & Speichern]
5. Validierung: Test-Call (`claude-haiku`) → zeigt verfügbare Modelle

**Google Gemini:**
1. Account: `aistudio.google.com` [Link öffnen ↗]
2. Key: Get API Key → Create [Link öffnen ↗]
3. Key einfügen → [Testen & Speichern]
4. Hinweis: Gratis-Tier hat Rate-Limits (15 RPM für Gemini Flash)

**Mistral:**
1. Account: `console.mistral.ai` [Link öffnen ↗]
2. Key: API Keys → Create [Link öffnen ↗]
3. Key einfügen → [Testen & Speichern]

**Lokal (Ollama):**
1. Ollama installieren: `ollama.com/download` [Link öffnen ↗]
2. Model laden: "Welches Model?" → Empfehlung: `llama3.1:8b` für schwache Rechner, `llama3.1:70b` für starke
3. Base-URL eingeben: `http://localhost:11434` → [Testen]
4. Hinweis: "Lokale Modelle sind kostenlos, aber langsamer und weniger fähig als Cloud-Modelle"

### Key-Speicherung

**Sicherheits-Levels:**
1. **MVP**: Verschlüsselt in SQLite mit App-Secret (AES-256). Secret wird beim First-Run generiert und im User-Profil-Ordner gespeichert. Nicht perfekt, aber besser als Plaintext.
2. **Electron**: OS-Keychain via `safeStorage` (Electron built-in). Nutzt macOS Keychain / Windows DPAPI / Linux libsecret.
3. **Nie**: Plaintext in DB oder Env-Vars.

### Key-Validierung

```python
async def validate_key(provider: str, key: str) -> dict:
    """Testet Key, gibt verfügbare Modelle zurück."""
    try:
        if provider == "openai":
            client = openai.AsyncOpenAI(api_key=key)
            models = await client.models.list()
            return {"valid": True, "models": [m.id for m in models.data if "gpt" in m.id]}
        elif provider == "anthropic":
            client = anthropic.AsyncAnthropic(api_key=key)
            # Minimaler Test-Call
            await client.messages.create(model="claude-haiku-4-20250414", max_tokens=1, messages=[{"role":"user","content":"hi"}])
            return {"valid": True, "models": ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-opus-4-20250514"]}
        # ... etc
    except AuthenticationError:
        return {"valid": False, "error": "Key ungültig"}
    except RateLimitError:
        return {"valid": False, "error": "Rate-Limit — Key gültig aber überlastet"}
    except InsufficientQuotaError:
        return {"valid": False, "error": "Kein Guthaben — bitte aufladen"}
```

### Monetarisierung — Realität

**Direkte Provision: ❌ Kein LLM-Anbieter bietet ein Referral/Affiliate-Programm für API-Nutzung.**

**Reale Optionen:**

| Modell | Beschreibung | Aufwand | Marge |
|--------|-------------|---------|-------|
| **BYOK (Bring Your Own Key)** | User nutzt eigenen Key, App kostenlos | Null | 0% |
| **Managed Proxy** | User zahlt euch, ihr routet an Provider. Z.B. €9.90/Mo für 1M Tokens inkl. | Hoch (Billing, Abuse, Support) | 30-50% |
| **App-Abo** | App kostenlos mit Limits (3 Bots, 10 Runs/Tag). Premium: €4.90/Mo | Mittel (Paywall, License-Check) | 100% (kein API-Cost) |
| **Template-Marketplace** | Premium-Bot-Vorlagen verkaufen (€0.99-4.99) | Niedrig | 70% nach Store-Fee |
| **Volume-Deals** | Ab ~$10k/Mo API-Spend: Enterprise-Preise bei Providern | Erst ab Scale | 10-20% Rabatt |

**Empfehlung für MVP → Scale:**
1. **MVP**: BYOK only. App kostenlos. Fokus auf Produkt.
2. **Traction**: App-Abo (Premium-Features: >3 Bots, Pipelines, Priority-Scheduling)
3. **Scale**: Managed Proxy als Convenience-Layer für Non-Tech-User
4. **Von Tag 1**: Token-Usage tracken (pro Provider, pro Bot, pro User) — ihr braucht diese Daten egal welches Modell

---

## D. CHANNELS — Notification-Architektur

### Flow

```
Bot Run fertig
    │
    ├──▶ Result in DB speichern (IMMER, unabhängig von Channels)
    │
    ▼
Notification-Dispatcher
    │
    ├── Check: Quiet Hours aktiv? → Queue für später
    ├── Check: notify_rule erfüllt? (always/on_new/on_error)
    │
    ▼
Für jeden aktiven Channel des Bots:
    ├──▶ Telegram: Bot-API → formatierte Nachricht
    ├──▶ E-Mail: SMTP → HTML-Mail mit Bot-Emoji, Titel, Output
    ├──▶ Webhook: POST {bot_id, run_id, status, output} an URL
    └──▶ Desktop Push: Electron Notification API
```

### Datenmodell

```sql
CREATE TABLE channels (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,       -- 'telegram' | 'email' | 'webhook' | 'push'
    name        TEXT,                -- "Mein Telegram", "Arbeit-Mail"
    config      TEXT NOT NULL,       -- JSON, verschlüsselt
    status      TEXT DEFAULT 'pending', -- 'connected' | 'pending' | 'error'
    last_used   DATETIME,
    error_msg   TEXT,                -- Letzter Fehler (z.B. "SMTP Auth failed")
    created_at  DATETIME
);

CREATE TABLE bot_channels (
    bot_id      TEXT REFERENCES bots(id) ON DELETE CASCADE,
    channel_id  TEXT REFERENCES channels(id) ON DELETE CASCADE,
    notify_rule TEXT DEFAULT 'always', -- 'always' | 'on_new' | 'on_results' | 'on_error' | 'never'
    format      TEXT DEFAULT 'short',  -- 'short' (Titel + Status) | 'full' (ganzer Output) | 'summary' (LLM-Zusammenfassung)
    PRIMARY KEY (bot_id, channel_id)
);

-- Notification-Queue für Quiet Hours / Retries
CREATE TABLE notification_queue (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT REFERENCES channels(id),
    bot_id      TEXT REFERENCES bots(id),
    run_id      TEXT REFERENCES runs(id),
    payload     TEXT,                -- JSON: formatierte Nachricht
    status      TEXT DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
    attempts    INTEGER DEFAULT 0,
    send_after  DATETIME,            -- Quiet Hours: frühester Sendezeitpunkt
    created_at  DATETIME
);
```

### Channel-Config pro Typ

```json
// Telegram
{"bot_token": "123:ABC", "chat_id": "987654321"}

// E-Mail  
{"smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_user": "...", "smtp_pass": "...", "from": "...", "to": "user@example.com"}

// Webhook
{"url": "https://example.com/webhook", "method": "POST", "headers": {"Authorization": "Bearer ..."}}

// Push (Electron)
{"enabled": true}  // Keine weitere Config nötig
```

### Telegram-Setup in der GUI

```
┌──────────────────────────────────────────────────────────┐
│  📱 Telegram einrichten                                   │
│                                                            │
│  Schritt 1: Telegram-Bot erstellen                        │
│  → Schreibe @BotFather auf Telegram                       │
│  → Sende /newbot und folge den Anweisungen               │
│  → Du bekommst einen Token (sieht so aus: 123456:ABC...) │
│    [Anleitung öffnen ↗]                                   │
│                                                            │
│  Schritt 2: Bot-Token einfügen                            │
│  [____________________________________________]            │
│                                                            │
│  Schritt 3: Chat verbinden                                │
│  → Schreibe deinem neuen Bot eine Nachricht auf Telegram  │
│  → Dann klicke hier:                                      │
│  [🔍 Chat suchen]                                         │
│                                                            │
│  ✅ Chat gefunden: "Ben" (ID: 1410940994)                 │
│                                                            │
│  [Test-Nachricht senden]     [Speichern]                  │
└──────────────────────────────────────────────────────────┘
```

**Technisch "Chat suchen"**: `getUpdates()` aufrufen, letzten Chat extrahieren. Einfach und zuverlässig.

### Notification-Format (konfigurierbar)

**`short`** (Default für Telegram):
```
🛒 eBay-Scout — ✅ Fertig
3 neue Treffer gefunden
14:30 · 2.1s · 340 Tokens
```

**`full`** (Default für E-Mail):
```
Subject: 🛒 eBay-Scout — 3 neue Treffer

[Ganzer Bot-Output als HTML-formatierte Mail]

---
openOrchestrator · 14:30 · Nächster Run: 15:30
```

**`summary`** (Premium-Feature, kostet Extra-Tokens):
```
LLM fasst den Output in 1-2 Sätzen zusammen.
Nützlich für Bots mit langem Output.
```

---

## E. OPENCLAW / BACKEND-ERWEITERUNGEN

| # | Was | Warum | Aufwand | Priorität |
|---|-----|-------|---------|-----------|
| E.1 | **Trigger mit Payload** | Bot A Output → Bot B Input. `_check_triggers()` muss `run.output` an den nächsten Bot übergeben. | Klein — 2h | P0 |
| E.2 | **Run-Input-Feld** | `Run`-Model braucht `input`-Feld das beim LLM-Call als User-Context mitgegeben wird. Existiert in DB, wird aber ignoriert. | Klein — 1h | P0 |
| E.3 | **Bot-Context laden** | Beim LLM-Call: Bot-Docs lesen + letzten Run-Output laden + als System-Context mitgeben. | Klein — 3h | P0 |
| E.4 | **Token-Tracking** | `usage` aus LLM-Response extrahieren → in Run speichern (`tokens_in`, `tokens_out`, `cost_estimate`). | Klein — 2h | P1 |
| E.5 | **Run-Cancellation** | asyncio Task pro Run tracken, Cancel-Endpoint, Timeout-Handling. | Klein — 3h | P1 |
| E.6 | **Scheduler** | APScheduler integrieren, Jobs aus DB laden, Live-Update bei Bot-Änderung. | Mittel — 1 Tag | P0 |
| E.7 | **Notification-Dispatch** | Nach Run → Channels abfragen → formatieren → senden (Telegram/SMTP/Webhook). Retry-Queue. | Mittel — 2 Tage | P1 |
| E.8 | **Pipeline-Runner** | Pipeline-Modell, sequentieller Runner, Output-Forwarding, Gesamt-Status. | Mittel — 2 Tage | P2 |
| E.9 | **Tool-Execution** | Bots können Tools nutzen (Web-Suche, Browser, Dateien). Entweder eigene Implementierung (Brave API, Playwright) oder OpenClaw als Subprocess. | Groß — 1 Woche | P1 |
| E.10 | **Structured Output** | Bots können JSON-Schema definieren → LLM gibt strukturierten Output → besser parsbar für Pipelines und Notifications. | Mittel — 1 Tag | P2 |
| E.11 | **Streaming** | Run-Output als Stream (SSE/WebSocket) statt erst am Ende. User sieht Bot "denken". | Mittel — 1 Tag | P2 |
| E.12 | **Multi-Provider Router** | Bot wählt Model → Router entscheidet welcher Key (OpenAI/Anthropic/etc.) genutzt wird. Fallback wenn ein Provider down. | Mittel — 1 Tag | P1 |

### E.9 Detail: Tool-Execution — Architektur-Entscheidung

**Option A: Eigene Tool-Implementierung (empfohlen für MVP)**
```python
# Bot-Runner bekommt Tool-Registry
tools = {
    "web_search": BraveSearchTool(api_key=settings.brave_key),
    "browser": PlaywrightTool(headless=True),
    "files": FilesTool(base_path=f"/data/bots/{bot.id}/"),
}

# LLM-Call mit Function Calling
response = await client.chat.completions.create(
    model=bot.model,
    messages=messages,
    tools=[t.schema for t in enabled_tools],
)

# Tool-Call-Loop (max 10 iterations)
while response.has_tool_calls and iterations < 10:
    results = await execute_tool_calls(response.tool_calls, tools)
    messages.extend(results)
    response = await client.chat.completions.create(...)
```

**Pro**: Volle Kontrolle, keine External-Dependency, leichtgewichtig
**Con**: Jedes Tool selbst bauen, kein Sandbox

**Option B: OpenClaw als Subprocess**
```python
# Bot-Run startet OpenClaw-Session
process = await asyncio.create_subprocess_exec(
    "openclaw", "run", "--prompt", bot.prompt, "--model", bot.model,
    "--tools", ",".join(bot.tools),
    stdout=PIPE, stderr=PIPE
)
```

**Pro**: Alle OpenClaw-Tools sofort verfügbar, Sandbox, Memory
**Con**: Dependency auf OpenClaw-Installation, schwerer zu debuggen, Overhead

**Empfehlung**: Option A für MVP. Drei Tools reichen erstmal (Web-Suche, Dateien, Code-Execution). Browser später. OpenClaw-Integration als optionaler "Power-Mode" in Phase 3.

---

## F. FEATURE-BACKLOG (priorisiert)

### P0 — Muss rein bevor jemand es nutzen kann
- [ ] API-Key-Eingabe + Validation (Settings-Page)
- [ ] Echter Bot-Runner (LLM-Call mit echtem Key statt Mock)
- [ ] Bot-Context/Memory (letzter Output + Docs)
- [ ] Bot bearbeiten (Edit-Modal)
- [ ] Trigger mit Payload (Output-Forwarding)
- [ ] Scheduler (APScheduler, Cron-basiert)
- [ ] Run-Timeout (Kill nach X Sekunden)
- [ ] Token-Usage Tracking
- [ ] Error-Handling: User-freundliche Fehlermeldungen ("Key ungültig", "Guthaben leer", "Timeout")

### P1 — Macht es nützlich
- [ ] Notification-Channels (Telegram, E-Mail, Webhook)
- [ ] "Channel hinzufügen" GUI
- [ ] Notification-Filter (always/on_new/on_error)
- [ ] Tool: Web-Suche (Brave API)
- [ ] Tool: Dateien (lesen/schreiben im Bot-Ordner)
- [ ] Run abbrechen (Cancel-Button)
- [ ] Bot aktivieren/deaktivieren (Toggle)
- [ ] Multi-Provider-Router (OpenAI + Anthropic + Gemini + Mistral + Lokal)
- [ ] Onboarding-Wizard (API-Key + erster Bot)
- [ ] 5 Templates: Web-Scout, Zusammenfassung, Übersetzer, Mail-Antwort, Recherche

### P2 — Macht es gut
- [ ] Pipeline-Builder (GUI + Backend)
- [ ] Tool: Browser (Playwright, headless)
- [ ] Tool: Code-Execution (Python Sandbox)
- [ ] Streaming (Bot-Output live sehen)
- [ ] Structured Output (JSON-Schema)
- [ ] Bot-Statistiken (Erfolgsrate, Token-Verbrauch, Kosten)
- [ ] Token-Usage Dashboard (pro Bot, gesamt, pro Provider)
- [ ] Ergebnisse pinnen / als wichtig markieren
- [ ] Run-Detail-View (einzelner Run mit vollem Log + Output)
- [ ] Dark Mode Toggle
- [ ] Bot duplizieren
- [ ] Quiet Hours
- [ ] Notification-Format wählbar (short/full/summary)

### P3 — Nice to have
- [ ] Suche über alle Ergebnisse (Volltextsuche)
- [ ] Ergebnisse exportieren (CSV, PDF)
- [ ] Bot-Docs Upload + inline bearbeiten
- [ ] Sprache DE/EN
- [ ] Tastatur-Shortcuts
- [ ] Bot-Import/Export (JSON)
- [ ] Bot-Sharing
- [ ] Bulk-Run
- [ ] System-Info (Version, API-Status, DB-Größe)
- [ ] Error-Log (globale Fehlerliste)
- [ ] Rate-Limiting pro Bot
- [ ] Hilfe-Seite / Docs
- [ ] Landing Page

### Electron-spezifisch (Phase 3)
- [ ] Electron Shell + Python Sidecar (PyInstaller)
- [ ] System Tray (Bots laufen im Hintergrund)
- [ ] Native OS-Notifications
- [ ] safeStorage für API-Keys
- [ ] Auto-Updater (electron-updater + eigener Update-Server)
- [ ] Installer: .dmg (Mac), .exe NSIS (Windows), .AppImage (Linux)
- [ ] App-Icon, Splash Screen, About-Dialog
- [ ] Deep-Links: `openorch://bot/xyz`
- [ ] First-Run Detection + Wizard

---

## G. TECH-STACK (final)

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| **Frontend** | React + Tailwind (Vite) | Bereits vorhanden, funktioniert |
| **Backend** | FastAPI (Python) + SQLite | Bereits vorhanden, leichtgewichtig, kein DB-Server nötig |
| **ORM** | SQLAlchemy | Bereits vorhanden |
| **Scheduler** | APScheduler (AsyncIO) | In-Process, SQLite-JobStore, kein Extra-Service |
| **Desktop** | Electron | Bewährt (VS Code, Cursor), großes Ökosystem |
| **Python Bundling** | PyInstaller | Ein Binary, cross-platform |
| **LLM-Clients** | openai + anthropic + google-generativeai + mistralai SDKs | Offizielle SDKs, gut maintained |
| **Lokal-LLM** | Ollama (OpenAI-kompatible API) | Kein Extra-SDK nötig, selber Client wie OpenAI |
| **Web-Suche** | Brave Search API | 2000 free/Mo, günstig danach, gute Qualität |
| **Browser** | Playwright (headless Chromium) | Standard, zuverlässig, async |
| **Telegram** | python-telegram-bot (async) | Offiziell empfohlen, gut dokumentiert |
| **E-Mail** | aiosmtplib + aioimaplib | Async, stdlib-kompatibel |
| **Key-Storage (Web)** | AES-256 verschlüsselt in SQLite | Besser als Plaintext, kein Keychain verfügbar |
| **Key-Storage (Electron)** | Electron safeStorage API | Nutzt OS-Keychain nativ |
| **Notifications (Electron)** | Electron Notification API | Native OS-Integration |
| **Auto-Update** | electron-updater | Standard, S3/GitHub-Releases als Backend |

---

## H. ARCHITEKTUR-DIAGRAMM

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              REACT FRONTEND (Vite)                 │  │
│  │  Dashboard │ Bot-Detail │ Pipelines │ Settings     │  │
│  │  Templates │ Channels   │ Onboarding│ Usage        │  │
│  └─────────────────────┬─────────────────────────────┘  │
│                         │ REST + WebSocket                │
│  ┌─────────────────────▼─────────────────────────────┐  │
│  │              FASTAPI BACKEND                       │  │
│  │                                                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │  │
│  │  │ Bot CRUD │ │ Pipeline │ │ Channel-Dispatch  │  │  │
│  │  │ + Runs   │ │ Runner   │ │ TG/Mail/Webhook   │  │  │
│  │  └────┬─────┘ └────┬─────┘ └───────────────────┘  │  │
│  │       │             │                               │  │
│  │  ┌────▼─────────────▼──────┐ ┌──────────────────┐  │  │
│  │  │     BOT RUNNER          │ │   SCHEDULER      │  │  │
│  │  │  ┌─────┐ ┌──────────┐  │ │  APScheduler     │  │  │
│  │  │  │ LLM │ │ Tools    │  │ │  Cron → Run-Queue│  │  │
│  │  │  │ API │ │ Search   │  │ └──────────────────┘  │  │
│  │  │  │     │ │ Browser  │  │                        │  │
│  │  │  │     │ │ Files    │  │ ┌──────────────────┐  │  │
│  │  │  │     │ │ Code     │  │ │   KEY STORE      │  │  │
│  │  │  └─────┘ └──────────┘  │ │  safeStorage /   │  │  │
│  │  └────────────────────────┘ │  AES-256         │  │  │
│  │                              └──────────────────┘  │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │              SQLite                           │  │  │
│  │  │  bots │ runs │ results │ pipelines │ channels│  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  /data/bots/{id}/  ← Bot-Docs & Memory (Filesystem)      │
└────────────────────────────────────────────────────────────┘
```

---

## I. RISIKEN & FALLSTRICKE

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| **Electron + Python Sidecar = doppelte Runtime, 300MB+** | User-Abschreckung bei Download | PyInstaller-Bundle komprimiert (~80MB). Akzeptabel — Cursor ist 500MB+. |
| **Python-Prozess stirbt / hängt** | App sieht "verbunden" aus aber Backend tot | Health-Check Endpoint `/health`, Electron überwacht Process, Auto-Restart. |
| **LLM-Kosten überraschen User** | Support-Anfragen, schlechte Reviews | Token-Usage prominent anzeigen. Warn-Threshold konfigurierbar. Tägliches/monatliches Budget-Limit pro Bot. |
| **Tool-Execution Sicherheit** | Bot löscht Dateien, greift auf System zu | Sandbox: Bot-Dateien nur in `/data/bots/{id}/`. Kein Shell-Zugriff. Browser headless + isoliert. |
| **Rate-Limits bei Providern** | Bots scheitern ständig | Exponential Backoff. Run-Status "rate_limited" statt "failed". Retry nach Cooldown. |
| **WhatsApp Business API Approval** | Wochen bis Monate für Freischaltung | Phase 2. Telegram als MVP-Channel (sofort, kostenlos, keine Approval). |
| **Scheduling-Drift bei vielen Bots** | 20 Bots alle "jede Stunde" → 20 gleichzeitige Runs | Jitter: ±30s Zufallsversatz. Max-Parallel-Limit. Queue. |
| **Context-Window Overflow** | Bot-Docs + letzer Output + Prompt > Model-Limit | Token-Counting vor LLM-Call. Truncation mit Warnung. Später: Chunking/RAG. |
| **SQLite bei vielen Runs** | Performance ab ~100k Rows | Indizes auf `runs(bot_id, started_at)`, `results(bot_id)`. WAL-Mode. Archivierung alter Runs (>90 Tage → komprimieren). Ausreichend bis ~1M Rows. |
| **Electron Auto-Update Signing** | Mac erfordert Apple Developer Account ($99/Jahr), Windows empfiehlt Code Signing (~$200/Jahr) | Für Beta: unsigned. Für Launch: Signing kaufen. Mac Gatekeeper umgehbar mit "trotzdem öffnen". |
