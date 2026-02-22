# openOrchestrator — Packaging Roadmap

## Phase 1: Docker (1 Tag)

### 1.1 Dockerfile
- [ ] Multi-stage build: Python 3.12-slim base
- [ ] Install Python deps (requirements.txt)
- [ ] Build frontend (Node 22 → npm run build → static dist/)
- [ ] Copy backend + frontend dist into final image
- [ ] Expose port 8080, CMD uvicorn
- [ ] SQLite DB in /data volume mount

### 1.2 docker-compose.yml
- [ ] Single service: openorchestrator
- [ ] Volume für /data (DB + bot docs)
- [ ] Port mapping 8080:8080
- [ ] Optional: .env file für API keys (statt UI-Eingabe)

### 1.3 Testen
- [ ] `docker build -t openorchestrator .`
- [ ] `docker compose up` → http://localhost:8080
- [ ] Fresh install flow: Password setzen → API key → Bot erstellen → Run
- [ ] Daten persistent nach Container-Restart

### 1.4 Publishing
- [ ] GitHub Container Registry (ghcr.io/yben1/openorchestrator)
- [ ] README mit `docker run` one-liner
- [ ] Landing page: Download-Button → Docker-Anleitung

---

## Phase 2: Electron Desktop App (3-5 Tage)

### 2.1 Projekt-Setup
- [ ] `/desktop/` Ordner im Repo
- [ ] `package.json` mit electron, electron-builder
- [ ] `main.js` — Electron main process
- [ ] Fenster erstellt, lädt `http://localhost:8080` (lokaler Backend-Server)

### 2.2 Python Backend bundlen
- [ ] PyInstaller spec für backend → single binary `openorchestrator-server`
- [ ] Alle Python deps eingeschlossen (fastapi, uvicorn, openai, anthropic, etc.)
- [ ] SQLite included (kein externer DB-Server)
- [ ] Build-Script: `pyinstaller --onefile --name openorchestrator-server backend/main.py`
- [ ] Testen: Binary startet, API erreichbar auf :8080

### 2.3 Electron + Backend Integration
- [ ] main.js: Backend-Binary als Child-Process starten
- [ ] Port-Check: Warten bis Backend auf :8080 antwortet, dann Fenster öffnen
- [ ] Graceful shutdown: Backend-Process killen wenn Electron schließt
- [ ] Error handling: Backend-Crash → User-Meldung + Restart-Option
- [ ] Logs: Backend stdout/stderr in Electron-Log-File

### 2.4 Frontend einbetten
- [ ] Vite build output (`frontend/dist/`) direkt in Electron als static files
- [ ] Oder: Electron lädt von localhost:8080 (Backend served bereits static files)
- [ ] Entscheidung: Backend served Frontend (einfacher) vs. Electron served Frontend (schneller)
- [ ] → Backend served Frontend ist einfacher, da Backend bereits alles hat

### 2.5 System Tray
- [ ] Tray-Icon (Logo als .ico/.icns/.png)
- [ ] Tray-Menü: Open, Settings, Quit
- [ ] "Close to tray" statt App beenden
- [ ] Startup-Option: "Launch at login" (optional)

### 2.6 Auto-Updater
- [ ] electron-updater mit GitHub Releases
- [ ] Update-Check beim Start + periodisch
- [ ] Notification: "Update verfügbar" → Install & Restart

### 2.7 Erster-Start Flow
- [ ] Splash screen während Backend hochfährt
- [ ] Onboarding-Wizard (bereits im Frontend vorhanden)
- [ ] Berechtigungen: Firewall-Prompt auf Mac, SmartScreen auf Windows

### 2.8 Platform-spezifisch

#### macOS
- [ ] .dmg Installer via electron-builder
- [ ] Code Signing (Apple Developer Account nötig — $99/Jahr, oder unsigned + Hinweis)
- [ ] Notarization (ohne → Gatekeeper-Warnung)
- [ ] Universal Binary (Intel + ARM)
- [ ] Info.plist: App-Name, Version, Icon

#### Windows
- [ ] .exe Installer (NSIS) via electron-builder
- [ ] Code Signing (optional, ohne → SmartScreen-Warnung)
- [ ] 64-bit only

#### Linux
- [ ] .AppImage (universal)
- [ ] Optional: .deb, .rpm
- [ ] Desktop-Entry file

### 2.9 Build Pipeline
- [ ] GitHub Actions Workflow
- [ ] Matrix build: macOS (arm64, x64), Windows (x64), Linux (x64)
- [ ] PyInstaller-Build pro Platform im CI
- [ ] electron-builder pro Platform
- [ ] Artefakte → GitHub Release (Draft)
- [ ] Checksums (SHA256)

### 2.10 Testen
- [ ] macOS: .dmg installieren, App starten, Bot erstellen + ausführen
- [ ] Windows: .exe installieren, gleicher Test
- [ ] Linux: AppImage starten, gleicher Test
- [ ] Update-Flow testen (v0.3.0 → v0.3.1)
- [ ] Deinstallation sauber (keine Reste)

---

## Phase 3: Distribution & Landing Page

### 3.1 GitHub Release
- [ ] Release v0.3.0 mit allen Binaries
- [ ] Release Notes (Features, Known Issues)
- [ ] CHANGELOG.md

### 3.2 Landing Page Update
- [ ] Download-Button → OS-Erkennung → richtiger Download-Link
- [ ] Fallback: alle Downloads auflisten
- [ ] Screenshot der App einbetten (kein Placeholder mehr)
- [ ] Installationsanleitung pro Platform

### 3.3 README
- [ ] Badges (Release, Docker, License)
- [ ] Quick Start (Docker + Desktop)
- [ ] Screenshots
- [ ] Feature-Liste
- [ ] Contributing Guide

---

## Bekannte Risiken & Entscheidungen

| Thema | Status | Notiz |
|-------|--------|-------|
| Python bundling | Offen | PyInstaller ist Standard, aber macOS Universal Binary ist tricky |
| Code Signing macOS | Offen | Ohne = Gatekeeper-Warnung ("nicht verifiziert"). $99/Jahr für Dev Account |
| Code Signing Windows | Offen | Ohne = SmartScreen-Warnung. EV-Zertifikat teuer (~$300/Jahr) |
| Binary-Größe | Erwartet ~150-200MB | Python Runtime + alle deps + Electron + Chromium |
| Startup-Zeit | Erwartet 3-5s | PyInstaller-Binary entpackt beim Start, danach schneller |
| Auto-Update Backend | Offen | Bei Update muss Python-Binary auch getauscht werden |
| Ollama Integration | Nice-to-have | Ollama automatisch mitinstallieren/starten? |

---

## Aufwand-Schätzung

| Phase | Aufwand | Ergebnis |
|-------|---------|----------|
| Docker | 1 Tag | `docker run` funktioniert, Image auf ghcr.io |
| Electron Basis | 2 Tage | App startet auf macOS, Backend embedded |
| Cross-Platform | 1-2 Tage | Windows + Linux builds, CI Pipeline |
| Polish | 1 Tag | Tray, Auto-Update, Signing, Screenshots |
| **Gesamt** | **5-6 Tage** | **Downloadbare App für alle 3 Platforms + Docker** |
