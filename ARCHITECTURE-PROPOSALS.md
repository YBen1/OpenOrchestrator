# openOrchestrator — Architektur-Vorschläge

## 🎯 Vision
Ein Dashboard (kein Chat!) in dem jeder — auch Nicht-Techniker — mehrere AI-Bots anlegen, konfigurieren und als Pipelines orchestrieren kann. Jeder Bot hat seinen eigenen Speicher/Dokumente.

---

## Vorschlag A: "Kanban-Style Pipeline Builder"

```
┌─────────────────────────────────────────────────┐
│  🏠 Dashboard                                    │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 📝 Texter │→│ 🔍 Prüfer │→│ 📧 Sender │       │
│  │  "Schreib │  │  "Check   │  │  "Schick  │       │
│  │   Entwurf"│  │   Grammatik│ │   per Mail"│      │
│  │  ✅ Fertig │  │  🔄 Läuft  │  │  ⏳ Wartet │      │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                   │
│  Meine Bots: [+ Neuer Bot]                       │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │🤖 Texter│ │🔍 Prüfer│ │📧 Sender│              │
│  │ 12 Docs │ │  3 Docs │ │  0 Docs│              │
│  └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────┘
```

**Wie es funktioniert:**
- Bots sind Karten die man per Drag & Drop zu Pipelines verbindet
- Jeder Bot hat: Name, Emoji, Persönlichkeit (Prompt), eigenen Ordner
- Pipelines: Bot A → Output wird Input für Bot B → etc.
- Status-Anzeige: ✅ Fertig | 🔄 Läuft | ⏳ Wartet | ❌ Fehler

**Tech-Stack:**
```
Frontend:  React + Tailwind (oder Next.js)
Backend:   FastAPI (Python) auf localhost:3000
Engine:    OpenClaw als Library/subprocess
Storage:   SQLite + Filesystem (ein Ordner pro Bot)
```

---

## Vorschlag B: "Rezept-basiert" (am einfachsten für Enduser)

```
┌─────────────────────────────────────────────────┐
│  🏠 Meine Rezepte                                │
│                                                   │
│  ┌─────────────────────────────────────┐         │
│  │ 📋 "Blog-Artikel erstellen"          │         │
│  │                                      │         │
│  │  Schritt 1: 🤖 Recherche-Bot        │         │
│  │    → Sucht Infos zum Thema          │         │
│  │                                      │         │
│  │  Schritt 2: 🤖 Schreib-Bot          │         │
│  │    → Schreibt den Artikel           │         │
│  │                                      │         │
│  │  Schritt 3: 🤖 SEO-Bot             │         │
│  │    → Optimiert für Google           │         │
│  │                                      │         │
│  │  [▶️ Starten]  [✏️ Bearbeiten]       │         │
│  └─────────────────────────────────────┘         │
│                                                   │
│  ┌─────────────────────────────────────┐         │
│  │ 📋 "E-Mail beantworten"             │         │
│  │  Schritt 1: 🤖 Leser → Zusammenfassung │      │
│  │  Schritt 2: 🤖 Antwort-Bot → Entwurf   │      │
│  │  [▶️ Starten]                            │      │
│  └─────────────────────────────────────┘         │
└─────────────────────────────────────────────────┘
```

**Kernidee:** User denkt nicht in "Bots" sondern in "Rezepten" (= Workflows).
Bots sind die Zutaten. Ein Rezept ist eine Pipeline.

**Vorteile:**
- Oma-tauglich: "Ich will einen Blog-Artikel → Klick auf Start"
- Vorlagen-Bibliothek: fertige Rezepte zum Kopieren
- Trotzdem flexibel: Power-User können eigene Rezepte bauen

---

## Vorschlag C: "Workspace mit Assistenten" (à la Notion + AI)

```
┌─────────────────────────────────────────────────┐
│  📁 Mein Workspace                               │
│                                                   │
│  ├── 📁 Blog                                     │
│  │   ├── 📄 Artikel-Entwurf.md                   │
│  │   ├── 📄 SEO-Analyse.md                       │
│  │   └── 🤖 Assistenten: [Texter] [SEO-Bot]     │
│  │                                                │
│  ├── 📁 Kundenanfragen                           │
│  │   ├── 📄 Anfrage-Mueller.md                   │
│  │   ├── 📄 Antwort-Entwurf.md                   │
│  │   └── 🤖 Assistenten: [Support-Bot]           │
│  │                                                │
│  └── 📁 Buchhaltung                              │
│      ├── 📄 Rechnungen-Feb.csv                   │
│      └── 🤖 Assistenten: [Buchhalter-Bot]        │
│                                                   │
│  ──────────────────────────────────────          │
│  🤖 Bot-Studio: [+ Neuer Assistent]              │
│  ┌────────┐ ┌──────────┐ ┌───────────┐          │
│  │📝 Texter│ │🔍 SEO-Bot │ │💰 Buchhalter│         │
│  │Kreativ  │ │Analytisch│ │Genau      │          │
│  │GPT-4    │ │Claude    │ │Gemini     │          │
│  └────────┘ └──────────┘ └───────────┘          │
└─────────────────────────────────────────────────┘
```

**Kernidee:** Ordner-basiert wie ein Dateisystem. Jeder Ordner kann Assistenten haben die auf die Dokumente darin zugreifen.

**Vorteile:**
- Natürliches Mental Model (jeder kennt Ordner)
- Bots sehen nur IHRE Dokumente (Isolation)
- Einfach zu verstehen: "Der Texter-Bot arbeitet im Blog-Ordner"

---

## Meine Empfehlung: **Hybrid aus A + B**

```
┌──────────────────────────────────────────────────┐
│  openOrchestrator                            │
│                                                    │
│  ┌─────────────┐  ┌──────────────────────────┐   │
│  │ 🤖 Meine     │  │  📋 Pipeline: Blog        │   │
│  │   Bots       │  │                           │   │
│  │              │  │  [Recherche] → [Texter]   │   │
│  │ • Recherche  │  │       ↓                   │   │
│  │ • Texter     │  │    [SEO-Bot]              │   │
│  │ • SEO-Bot    │  │                           │   │
│  │ • Support    │  │  Status: ✅ 3/3 fertig     │   │
│  │              │  │  Letzte Ausgabe: 📄        │   │
│  │ [+ Neu]      │  │                           │   │
│  └─────────────┘  │  [▶️ Nochmal] [📄 Ergebnis]│   │
│                    └──────────────────────────┘   │
│                                                    │
│  📊 Letzte Läufe                                  │
│  ┌────────────────────────────────────────────┐   │
│  │ 14:30  Blog-Pipeline     ✅ 3/3  12 Sek    │   │
│  │ 13:15  Support-Pipeline  ✅ 2/2   8 Sek    │   │
│  │ 11:00  Blog-Pipeline     ❌ 2/3  Timeout   │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Architektur:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Orchestrator   │────▶│  OpenClaw    │
│   (React)    │◀────│   API (FastAPI)  │◀────│  (Engine)    │
│   :3000      │     │   :8080          │     │  Sessions    │
└─────────────┘     └──────────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   SQLite    │
                    │   + Bot-    │
                    │   Ordner    │
                    └─────────────┘
```

### Datenmodell:

```
Bot:
  - id, name, emoji, description
  - system_prompt (Persönlichkeit)
  - model (gpt-4, claude, gemini...)
  - documents_path (/srv/orchestrator/bots/{id}/)
  - settings (temperature, max_tokens...)

Pipeline:
  - id, name, description
  - steps: [{bot_id, input_source, output_target}]
  - schedule: (manual | cron | trigger)

Run:
  - id, pipeline_id, started_at, status
  - steps: [{bot_id, input, output, duration, status}]
```

### API (localhost:8080):

```
# Bots
POST   /api/bots              → Bot anlegen
GET    /api/bots              → Alle Bots
GET    /api/bots/{id}         → Bot-Details + Dokumente
PUT    /api/bots/{id}         → Bot bearbeiten
DELETE /api/bots/{id}         → Bot löschen
POST   /api/bots/{id}/run     → Bot einzeln ausführen

# Pipelines
POST   /api/pipelines         → Pipeline anlegen
GET    /api/pipelines         → Alle Pipelines
POST   /api/pipelines/{id}/run → Pipeline starten
GET    /api/pipelines/{id}/runs → Lauf-Historie

# Dokumente
GET    /api/bots/{id}/docs    → Bot-Dokumente
POST   /api/bots/{id}/docs    → Dokument hochladen
```

### Warum dieser Ansatz:

1. **Einfach für Nicht-Techniker**: Bots anlegen = Name + Beschreibung + Emoji
2. **Mächtig für Power-User**: Pipelines, API, eigene Prompts
3. **Übersichtlich**: Dashboard statt Chat-Chaos
4. **Isoliert**: Jeder Bot hat seinen eigenen Ordner
5. **Erweiterbar**: Später Telegram-Anbindung, Webhooks, Scheduling
6. **Verkaufbar**: Als SaaS oder Self-hosted (doctogo.ai?)

### MVP (Phase 1 — 1-2 Wochen):
- [ ] FastAPI Backend mit SQLite
- [ ] Bot CRUD (anlegen, bearbeiten, löschen)
- [ ] Einzelner Bot-Run (Prompt → OpenClaw → Ergebnis)
- [ ] Einfaches React-Dashboard
- [ ] Bot-Dokumente (Upload/Download)

### Phase 2:
- [ ] Pipeline Builder (Drag & Drop)
- [ ] Run-Historie + Logs
- [ ] Vorlagen-Bibliothek

### Phase 3:
- [ ] Multi-User (Accounts)
- [ ] Telegram-Bot pro User
- [ ] Scheduling (Cron)
- [ ] Marketplace für Bot-Templates
