# openOrchestrator — Vision

## Was ist openOrchestrator?

Eine **einfache Desktop-App** (später Electron) mit der jeder — ohne technisches Wissen — AI-Bots erstellen, verwalten und automatisieren kann.

**Zielgruppe:** Menschen die ChatGPT kennen, aber nie ein Terminal öffnen würden.

## Kern-Prinzip

> **Einfach starten, bei Bedarf erweitern.**

Standard: API-Key eingeben → Bot erstellen → läuft.
Power-User: Gateways zuschalten für Telegram, WhatsApp, Smart Home, etc.

## Architektur

```
┌──────────────────────────────────────────────┐
│           openOrchestrator UI (React)        │
│     Einfache, Apple-style Oberfläche         │
├──────────────────────────────────────────────┤
│           Bot Engine (Kern)                  │
│                                              │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ LLM     │ │ Browser  │ │ Web Search   │  │
│  │ Runner  │ │ (PW)     │ │ + Fetch      │  │
│  │ (pi-ai) │ │          │ │              │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Files   │ │ Image    │ │ Code         │  │
│  │ R/W     │ │ Vision   │ │ Sandbox      │  │
│  └─────────┘ └──────────┘ └──────────────┘  │
├──────────────────────────────────────────────┤
│        Zuschaltbare Gateways (optional)      │
│                                              │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │Telegram│ │WhatsApp│ │Discord │ ...        │
│  └────────┘ └────────┘ └────────┘           │
│  ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ E-Mail │ │ Nodes  │ │ Slack  │ ...        │
│  └────────┘ └────────┘ └────────┘           │
└──────────────────────────────────────────────┘
```

## Kern (immer verfügbar, keine Zusatz-Software)

### LLM Runner
- Basiert auf **pi-ai** Library (bereits in OpenClaw-Codebase enthalten)
- Multi-Provider: OpenAI, Anthropic, Google, Mistral, Ollama, AWS Bedrock, Azure, etc.
- Automatischer Failover wenn ein Provider down ist
- Token-Tracking & Kosten-Schätzung
- Tool-Call-Loop (LLM will Tool nutzen → ausführen → Ergebnis zurück → nächste Runde)
- Context-Window-Management (Compaction wenn Konversation zu lang)

### Browser (Playwright)
- Bereits in OpenClaw als `src/browser/` implementiert (~15.000 LOC)
- Eigenständiger HTTP-Server der Playwright/Chromium steuert
- Braucht KEIN Gateway — läuft als eigener Service
- Kann: Seiten öffnen, navigieren, Formulare ausfüllen, Screenshots, DOM lesen
- Headless (Server) oder sichtbar (Desktop/Electron)
- **Kern-Feature für Agenten** — ein Bot der nicht browsen kann, ist blind

### Web Search + Fetch
- Brave Search API (2.000 Abfragen/Monat kostenlos)
- URL → Markdown-Extraktion (Readability-Algorithmus)
- Bereits als `src/agents/tools/web-search.ts` und `web-fetch.ts` vorhanden
- Kein Gateway nötig — direkte HTTP-Calls

### Dateien
- Lesen, Schreiben, Bearbeiten im Bot-eigenen Workspace
- Jeder Bot hat seinen eigenen Docs-Ordner
- Bereits implementiert

### Image/Vision
- Bilder analysieren via Provider-API (GPT-4o Vision, Claude, Gemini)
- Bereits als Tool vorhanden

### Code Sandbox (geplant)
- Python/JavaScript ausführen in isolierter Umgebung
- Für Datenanalyse, Berechnungen, Automatisierung

## Zuschaltbare Gateways

Gateways sind **optionale Module** die man im UI aktiviert. Jedes Gateway hat:
- Einen Setup-Wizard mit Schritt-für-Schritt-Anleitung
- Status-Anzeige (connected/disconnected)
- Pro-Bot-Konfiguration (welcher Bot nutzt welches Gateway)

### Geplante Gateways

| Gateway | Funktion | Komplexität |
|---------|----------|-------------|
| **Telegram** | Bot antwortet im Telegram-Chat | Einfach (Bot-Token) |
| **Discord** | Bot als Discord-Bot oder Webhook | Einfach (Webhook-URL) |
| **Slack** | Incoming Webhook oder Bot | Einfach |
| **E-Mail** | SMTP senden + IMAP empfangen | Mittel |
| **Ntfy.sh** | Push-Notifications aufs Handy | Sehr einfach |
| **WhatsApp** | Via Business API oder Bridge | Komplex |
| **Nodes** | Smart Home, Remote-Geräte steuern | Komplex |
| **Webhook** | Beliebige HTTP-Callbacks | Einfach (bereits da) |

## Was wir von OpenClaw übernehmen

| Komponente | Quelle | Anpassung |
|---|---|---|
| LLM Runner + Tool-Loop | `src/agents/pi-embedded-runner/` | Als Node-Service wrappen, von Python aus aufrufen |
| Browser Control | `src/browser/` | Eigenständig starten, HTTP-API exposed |
| Web Search | `src/agents/tools/web-search.ts` | Direkt nutzen |
| Web Fetch | `src/agents/tools/web-fetch.ts` | Direkt nutzen |
| System Prompt Builder | `src/agents/system-prompt.ts` | Vereinfacht für oO |
| Model Auth + Fallback | `src/agents/model-auth.ts` | Vereinfacht (UI statt Config-Dateien) |
| Model Catalog | `src/agents/model-catalog.ts` | Für Model-Dropdown |
| Tool-Loop-Detection | `src/agents/tool-loop-detection.ts` | Direkt nutzen |
| Context Compaction | `src/agents/compaction.ts` | Direkt nutzen |

## Was wir NICHT übernehmen (eigene, einfachere Lösung)

| Komponente | Warum nicht |
|---|---|
| Gateway/Router | Zu komplex — eigenes FastAPI-Backend reicht |
| Auto-Reply System | Nicht nötig — Bots werden manuell/scheduled getriggert |
| Session-Management | Einfacher: 1 Bot = 1 Session in SQLite |
| Channel-Plugins | Eigene simple Webhook/API-Integrationen |
| Config (YAML) | SQLite + UI statt Textdateien |
| CLI | Nicht nötig — alles über UI |
| Native Apps (Swift/Kotlin) | Electron statt native |
| Pairing/Bonjour | Nicht nötig für v1 |
| TUI (Terminal UI) | Nicht nötig — Web-UI |

## Technischer Plan

### Phase 1: Kern stärken (aktuell)
- [x] Bot CRUD, Scheduling, Templates, Dark Mode
- [x] Multi-Provider LLM (direkte API-Calls)
- [x] Standard/Advanced UI-Split
- [x] App-Auth + API-Key-Verschlüsselung
- [ ] **pi-ai als LLM-Engine** (statt eigener Provider-Calls)
- [ ] **Browser-Tool** (Playwright als eigener Service)
- [ ] Web-Search und Web-Fetch als eigenständige Tools

### Phase 2: Gateways
- [ ] Gateway-Architektur (Plugin-System)
- [ ] Telegram Gateway (bidirektional)
- [ ] Discord Webhook Gateway
- [ ] E-Mail Gateway (SMTP/IMAP)
- [ ] Ntfy.sh Push Gateway

### Phase 3: Electron
- [ ] Electron Shell + Python Sidecar
- [ ] Browser sichtbar (nicht headless)
- [ ] OS-Keychain für Secrets
- [ ] Auto-Updater, Installer

### Phase 4: Community
- [ ] Skill/Plugin-Marketplace
- [ ] Bot-Templates Community-Sharing
- [ ] Self-hosted vs. Cloud Option

## Abgrenzung zu OpenClaw

| | OpenClaw | openOrchestrator |
|---|---|---|
| **Zielgruppe** | Entwickler, Power-User | Jedermann |
| **Setup** | CLI, YAML-Config, Terminal | GUI, Klick-Setup |
| **Interface** | Telegram/WhatsApp/CLI | Web-Dashboard (+ Electron) |
| **Konfiguration** | Config-Dateien | UI mit Wizards |
| **Erweiterung** | YAML + TypeScript | GUI + Plugin-Store |
| **Kern-Engine** | Gleich (pi-ai) | Gleich (pi-ai) |
| **Tools** | Gleich (Browser, Web, Files) | Gleich (Browser, Web, Files) |

openOrchestrator ist die **freundliche Oberfläche** für die gleiche starke Engine.
