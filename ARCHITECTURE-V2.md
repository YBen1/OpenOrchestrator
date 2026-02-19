# openOrchestrator — Dashboard Architecture v2

## 🎯 Kernidee
Ein Dashboard wo jeder User seine eigenen Bots anlegt, startet, überwacht. Wie ein **Missions-Kontrollzentrum** für AI-Bots.

---

## So sieht das aus:

```
┌──────────────────────────────────────────────────────────────┐
│  🎛️  openOrchestrator          Ben ▾    ⚙️  🔔 3       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Meine Bots                                    [+ Neuer Bot] │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │ 🛒 eBay-Scout    │  │ 👗 Vinted-Finder │  │ 💻 Dev-Bot    ││
│  │                  │  │                  │  │              ││
│  │ "Findet Deals   │  │ "Sucht Vintage   │  │ "Baut Code   ││
│  │  unter 50€"     │  │  Sneaker < 80€"  │  │  nach Spec"  ││
│  │                  │  │                  │  │              ││
│  │ 🟢 Läuft         │  │ 🟢 Läuft         │  │ ⏸️ Pausiert   ││
│  │ Letzte: 14:30   │  │ Letzte: 14:28   │  │ Letzte: 12:00││
│  │ 12 Ergebnisse   │  │ 3 Ergebnisse    │  │ 2 Commits    ││
│  │                  │  │                  │  │              ││
│  │ [▶️ Run] [📋 Log] │  │ [▶️ Run] [📋 Log] │  │ [▶️ Run] [📋]  ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ 🧪 Test-Bot      │  │ 📧 Mail-Bot      │                   │
│  │                  │  │                  │                   │
│  │ "Testet nach    │  │ "Beantwortet    │                   │
│  │  jedem Dev-Bot" │  │  Support-Mails" │                   │
│  │                  │  │                  │                   │
│  │ ⏳ Wartet auf    │  │ 🔴 Gestoppt      │                   │
│  │   Dev-Bot       │  │                  │                   │
│  │ 0 Ergebnisse    │  │ 47 beantwortet  │                   │
│  │                  │  │                  │                   │
│  │ [⏸️ Auto] [📋 Log]│  │ [▶️ Run] [📋 Log] │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
│  ─── Verknüpfungen ──────────────────────────────────────── │
│                                                              │
│  💻 Dev-Bot ──fertig──▶ 🧪 Test-Bot                          │
│  🛒 eBay-Scout ──Fund──▶ 📱 Telegram-Nachricht               │
│  👗 Vinted-Finder ──Fund──▶ 📱 Telegram-Nachricht            │
│                                                              │
│  ─── Letzte Aktivität ───────────────────────────────────── │
│                                                              │
│  14:30  🛒 eBay     "Nike Air Max 90 — 35€"          ✅     │
│  14:28  👗 Vinted   "3 neue Treffer für Sneaker"      ✅     │
│  12:01  🧪 Tester   "2 Tests failed: auth.test.ts"   ❌     │
│  12:00  💻 Dev-Bot  "Feature: Login implementiert"    ✅     │
│  11:45  🛒 eBay     "Keine neuen Deals"               ℹ️     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Bot anlegen (Modal):

```
┌──────────────────────────────────────────┐
│  Neuer Bot                          ✕    │
│                                          │
│  Name:    [eBay-Scout              ]     │
│  Emoji:   [🛒]                           │
│                                          │
│  Was soll er tun?                        │
│  ┌──────────────────────────────────┐    │
│  │ Suche auf eBay Kleinanzeigen    │    │
│  │ nach Nike Air Max unter 50€.    │    │
│  │ Melde neue Angebote mit Preis   │    │
│  │ und Link.                       │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Model:   [Claude Sonnet ▾]             │
│  Tools:   ☑️ Web-Suche  ☑️ Browser       │
│           ☐ Code  ☐ Dateien             │
│                                          │
│  Zeitplan:                               │
│  ○ Manuell (ich starte ihn)             │
│  ● Alle [30] Minuten                    │
│  ○ Wenn anderer Bot fertig: [____▾]     │
│                                          │
│  Ergebnisse senden an:                   │
│  ☑️ Dashboard  ☐ Telegram  ☐ E-Mail     │
│                                          │
│  [Abbrechen]              [Bot anlegen]  │
└──────────────────────────────────────────┘
```

---

## Bot-Detailseite:

```
┌──────────────────────────────────────────────────────────┐
│  🛒 eBay-Scout                    [▶️ Jetzt starten]  ⚙️  │
│  "Suche auf eBay nach Nike Air Max unter 50€"           │
│                                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 127     │ │ 23      │ │ 30 min  │ │ 98%     │      │
│  │ Läufe   │ │ Treffer │ │ Intervall│ │ Erfolg  │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                          │
│  📋 Ergebnisse                              [Alle | Neu] │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 14:30  Nike Air Max 90 Gr.43 — 35€               │  │
│  │        ebay.de/itm/12345  🟢 Neu                   │  │
│  │                                                    │  │
│  │ 14:00  Nike Air Max 97 Gr.42 — 48€               │  │
│  │        ebay.de/itm/67890  📌 Gemerkt               │  │
│  │                                                    │  │
│  │ 13:30  Keine neuen Treffer                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  📄 Bot-Dokumente (sein "Gedächtnis")                    │
│  ├── bekannte_angebote.json                              │
│  ├── suchkriterien.md                                    │
│  └── letzte_ergebnisse.md                                │
│                                                          │
│  📊 Log                                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 14:30:01  Starte eBay-Suche...                    │  │
│  │ 14:30:03  Gefunden: 3 neue Angebote               │  │
│  │ 14:30:04  Filtere: 1 unter 50€                    │  │
│  │ 14:30:05  ✅ Fertig. 1 neuer Treffer.              │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Technische Architektur:

```
                    ┌──────────────┐
                    │   Browser    │
                    │   React UI   │
                    │   :3000      │
                    └──────┬───────┘
                           │ REST + WebSocket (Live-Updates)
                           ▼
                    ┌──────────────┐
                    │  Orchestrator │
                    │  API (Python) │
                    │  :8080        │
                    └──┬───┬───┬───┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Bot-Run  │ │ Bot-Run  │ │ Bot-Run  │
        │ (Process)│ │ (Process)│ │ (Process)│
        │ eBay     │ │ Vinted   │ │ Dev-Bot  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │             │             │
             ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ 📁 Docs  │ │ 📁 Docs  │ │ 📁 Docs  │
        │ /bots/1/ │ │ /bots/2/ │ │ /bots/3/ │
        └──────────┘ └──────────┘ └──────────┘
```

### Komponenten:

**1. Frontend (React + Tailwind)**
- Dashboard mit Bot-Karten
- Bot-Editor (anlegen/bearbeiten)
- Live-Log (WebSocket)
- Ergebnis-Feed
- Verknüpfungs-Editor (Bot A → Bot B)

**2. Orchestrator API (FastAPI/Python)**
- Bot CRUD
- Run-Management (Start/Stop/Schedule)
- Trigger-System (Bot A fertig → Bot B starten)
- WebSocket für Live-Updates
- Dokument-Management pro Bot

**3. Bot Runner**
- Jeder Bot-Run = isolierter Prozess
- OpenClaw Session als Engine ODER direkte LLM-API-Calls
- Zugriff nur auf eigenen Docs-Ordner
- Stdout/Stderr → Log-Stream → WebSocket → UI

**4. Trigger/Verknüpfungen**
```python
triggers = [
    {"when": "bot:dev-bot:completed", "then": "bot:test-bot:start"},
    {"when": "bot:ebay-scout:result", "then": "notify:telegram"},
    {"when": "schedule:*/30 * * * *", "then": "bot:ebay-scout:start"},
]
```

---

## Datenmodell (SQLite):

```sql
CREATE TABLE bots (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    emoji       TEXT DEFAULT '🤖',
    description TEXT,
    prompt      TEXT NOT NULL,      -- "Was soll er tun?"
    model       TEXT DEFAULT 'claude-sonnet',
    tools       TEXT DEFAULT '[]',  -- JSON: ["web_search", "browser"]
    schedule    TEXT,                -- cron expression oder NULL
    docs_path   TEXT,                -- /srv/orchestrator/bots/{id}/
    notify      TEXT DEFAULT '["dashboard"]',  -- JSON
    created_at  DATETIME,
    updated_at  DATETIME
);

CREATE TABLE triggers (
    id          TEXT PRIMARY KEY,
    source_bot  TEXT REFERENCES bots(id),
    event       TEXT NOT NULL,       -- "completed" | "failed" | "result"
    target_bot  TEXT REFERENCES bots(id),
    target_action TEXT DEFAULT 'start',
    enabled     BOOLEAN DEFAULT 1
);

CREATE TABLE runs (
    id          TEXT PRIMARY KEY,
    bot_id      TEXT REFERENCES bots(id),
    trigger     TEXT,                -- "manual" | "schedule" | "trigger:dev-bot"
    status      TEXT DEFAULT 'running', -- running|completed|failed|cancelled
    input       TEXT,
    output      TEXT,
    log         TEXT,
    started_at  DATETIME,
    finished_at DATETIME,
    duration_ms INTEGER
);

CREATE TABLE results (
    id          TEXT PRIMARY KEY,
    bot_id      TEXT REFERENCES bots(id),
    run_id      TEXT REFERENCES runs(id),
    title       TEXT,
    content     TEXT,
    url         TEXT,
    metadata    TEXT,                -- JSON
    pinned      BOOLEAN DEFAULT 0,
    created_at  DATETIME
);
```

---

## Use Cases die sofort funktionieren:

### 🛒 eBay/Vinted Scout
- Bot sucht alle 30 Min per Web-Search
- Neue Treffer → Dashboard + Telegram
- Merkt sich bekannte Angebote (kein Spam)

### 💻 Dev + Test Pipeline
- Dev-Bot bekommt Spec → schreibt Code → speichert in /docs
- Trigger: Dev fertig → Test-Bot startet
- Test-Bot liest Code aus Dev-Bot /docs → testet → Report

### 📧 Support-Bot
- Liest Mails (oder Input-Feld)
- Schreibt Antwort-Entwurf
- User reviewed im Dashboard → Freigabe

### 📊 Research-Bot
- Täglicher Run: "Was gibt's Neues zu [Thema]?"
- Ergebnisse als Feed im Dashboard
- Exportiert als Newsletter-Entwurf

---

## MVP-Plan (Phase 1):

```
Woche 1:
├── FastAPI Grundgerüst
├── SQLite + Datenmodell
├── Bot CRUD API
├── Einfacher Bot-Runner (OpenClaw subprocess)
└── React Dashboard (Bot-Karten + Status)

Woche 2:
├── Bot-Detail-Seite (Log + Ergebnisse)
├── WebSocket Live-Updates
├── Trigger-System (Bot A → Bot B)
├── Schedule (Cron)
└── Docs-Ordner pro Bot

Woche 3:
├── Polish UI
├── Telegram-Notifications
├── Vorlagen (eBay-Scout, Dev+Test, etc.)
└── Docker-Compose für Easy Setup
```
