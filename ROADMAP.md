# openOrchestrator — Projekt-Roadmap

## 🎯 Ziel
Desktop-App (Electron) in der nicht-technische User eigene AI-Bots anlegen, verknüpfen und überwachen. Kein Terminal, kein Code, Doppelklick & fertig.

---

## 📋 Was fehlt / Was brauchen wir

### 1. CORE — Bot-Engine (Backend)

| # | Feature | Status | Beschreibung |
|---|---------|--------|--------------|
| 1.1 | **Echter Bot-Runner** | 🔴 fehlt | Aktuell: einfacher LLM-Call. Braucht: Tool-Ausführung (Web-Suche, Browser, Dateien), mehrstufige Runs, Kontext/Memory pro Bot |
| 1.2 | **Bot-Memory / Docs** | 🟡 Skeleton | Ordner existiert, aber Bots lesen/schreiben dort nicht. Braucht: Bot kann Dateien ablegen, beim nächsten Run wieder lesen ("Gedächtnis") |
| 1.3 | **Scheduling** | 🔴 fehlt | Cron-basiertes Scheduling. DB-Feld `schedule` existiert, aber kein Scheduler läuft |
| 1.4 | **Trigger-Engine** | 🟡 Basis da | Trigger feuern bei "completed", aber: kein Output-Forwarding (Bot A Output → Bot B Input), kein "on result contains X" |
| 1.5 | **Run-Isolation** | 🔴 fehlt | Bots laufen aktuell im selben Prozess. Braucht: Subprocess/Container-Isolation, Timeout, Memory-Limit |
| 1.6 | **API-Key-Management** | 🔴 fehlt | User muss eigene Keys eingeben können (OpenAI, Anthropic). Sicher speichern, pro Bot oder global |
| 1.7 | **Vorlagen / Templates** | 🔴 fehlt | Vorgefertigte Bot-Rezepte: "eBay-Scout", "Mail-Antwort", "Zusammenfassung", "Übersetzer" |

### 2. GUI — Frontend Features

| # | Feature | Status | Beschreibung |
|---|---------|--------|--------------|
| 2.1 | **Bot bearbeiten** | 🔴 fehlt | Bot-Card → Edit-Modal (Name, Prompt, Model, Tools ändern) |
| 2.2 | **Bot-Status live** | 🟡 Basis da | WebSocket existiert, aber nur in Detail-View. Dashboard-Cards brauchen Live-Status |
| 2.3 | **Ergebnis-Detail-View** | ✅ gerade gebaut | Activity expandierbar, Output sichtbar |
| 2.4 | **Verknüpfungen visuell erstellen** | 🔴 fehlt | GUI zum Verbinden: "Wenn Bot A fertig → starte Bot B". Drag & Drop oder Dropdown |
| 2.5 | **Dokumente / Bot-Dateien** | 🔴 fehlt | Upload & Anzeige von Bot-Dokumenten (sein "Wissen") |
| 2.6 | **Einstellungen-Seite** | 🔴 fehlt | API-Keys, Benachrichtigungen, Theme, Sprache |
| 2.7 | **Onboarding / Wizard** | 🔴 fehlt | Erster Start: "Willkommen! Lass uns deinen ersten Bot einrichten." |
| 2.8 | **Template-Galerie** | 🔴 fehlt | Klick → Bot aus Vorlage erstellen |
| 2.9 | **Bot Start/Stop/Pause** | 🟡 nur Run | Fehlt: Pause, Stop (laufenden Run abbrechen), Deaktivieren |
| 2.10 | **Dark Mode Toggle** | 🔴 fehlt | Aktuell nur Light. Braucht Toggle (wie Lexpa) |

### 3. CHANNELS — Benachrichtigungen (OpenClaw-Features für GUI)

> Der User soll in der GUI Channels hinzufügen können — nicht im Terminal.

| # | Feature | GUI-Element | Was passiert |
|---|---------|-------------|--------------|
| 3.1 | **📱 Telegram hinzufügen** | Button "Channel hinzufügen → Telegram" | Zeigt Bot-Token-Eingabe + Anleitung (BotFather). Oder: QR-Code scannen |
| 3.2 | **💬 WhatsApp hinzufügen** | Button "Channel hinzufügen → WhatsApp" | QR-Code wird in der App angezeigt, User scannt mit WhatsApp |
| 3.3 | **📧 E-Mail hinzufügen** | Button "Channel hinzufügen → E-Mail" | SMTP/IMAP-Eingabe oder OAuth (Gmail, Outlook) |
| 3.4 | **🔔 Desktop-Push** | Toggle in Einstellungen | Electron Notifications (native OS-Push) |
| 3.5 | **🪝 Webhook** | "Channel hinzufügen → Webhook" | URL eingeben, Bot postet Ergebnisse dorthin |
| 3.6 | **Channel pro Bot konfigurieren** | Im Bot-Edit-Modal: "Ergebnisse senden an: ☑️ Dashboard ☑️ Telegram ☐ E-Mail" | Dropdown/Checkboxes |
| 3.7 | **Channel-Status anzeigen** | Einstellungen → Channels: "Telegram ✅ verbunden", "WhatsApp ❌ nicht verbunden" | Live-Status-Check |

### 4. TOOLS — Bot-Werkzeuge (OpenClaw-Features als GUI)

> Was ein Bot "kann" — der User wählt per Checkbox, nicht per Config-Datei.

| # | Tool | GUI-Label | Was der Bot damit kann |
|---|------|-----------|----------------------|
| 4.1 | **🔍 Web-Suche** | "Im Internet suchen" | Brave Search, Google — Bot kann recherchieren |
| 4.2 | **🌐 Browser** | "Webseiten besuchen" | Seiten öffnen, lesen, Formulare ausfüllen, Screenshots |
| 4.3 | **📁 Dateien** | "Dateien lesen & schreiben" | Bot kann Dateien in seinem Ordner verwalten |
| 4.4 | **📧 E-Mail lesen** | "E-Mails lesen" | IMAP-Zugriff (braucht Channel-Setup) |
| 4.5 | **📧 E-Mail senden** | "E-Mails schreiben" | SMTP (braucht Channel-Setup) |
| 4.6 | **📅 Kalender** | "Kalender lesen" | Google Calendar / CalDAV |
| 4.7 | **💻 Code ausführen** | "Code schreiben & ausführen" | Sandbox für Python/JS (z.B. Datenanalyse) |
| 4.8 | **🖼️ Bilder analysieren** | "Bilder verstehen" | Vision-Model, Screenshots interpretieren |
| 4.9 | **🗣️ Vorlesen** | "Ergebnisse vorlesen" | TTS — Ergebnis als Audio abspielen |
| 4.10 | **📊 Tabellen / CSV** | "Tabellen verarbeiten" | CSV/Excel lesen, filtern, zusammenfassen |

### 5. ELECTRON — Desktop-App Packaging

| # | Feature | Status | Beschreibung |
|---|---------|--------|--------------|
| 5.1 | **Electron Shell** | 🔴 fehlt | React-Frontend in Electron-Window rendern |
| 5.2 | **Python Sidecar** | 🔴 fehlt | FastAPI-Backend als Child-Process starten (PyInstaller oder embedded Python) |
| 5.3 | **Auto-Updater** | 🔴 fehlt | electron-updater für automatische Updates |
| 5.4 | **System Tray** | 🔴 fehlt | App minimiert in Tray, Bots laufen weiter |
| 5.5 | **Native Notifications** | 🔴 fehlt | OS-Level Push wenn Bot fertig |
| 5.6 | **Installer** | 🔴 fehlt | .dmg (Mac), .exe/.msi (Windows), .AppImage (Linux) |
| 5.7 | **App Icon & Branding** | 🔴 fehlt | Logo, Splash Screen, About-Dialog |
| 5.8 | **First-Run Setup** | 🔴 fehlt | API-Key eingeben, Optional: Channels einrichten, Ersten Bot erstellen |

### 6. DATA & SECURITY

| # | Feature | Status | Beschreibung |
|---|---------|--------|--------------|
| 6.1 | **Lokale Datenhaltung** | ✅ SQLite | Alles lokal, keine Cloud nötig |
| 6.2 | **API-Key Verschlüsselung** | 🔴 fehlt | Keys im OS-Keychain (keytar) oder verschlüsselt in DB |
| 6.3 | **Export/Import** | 🔴 fehlt | Bots + Daten exportieren/importieren (Backup, Gerätewechsel) |
| 6.4 | **Multi-User** | 🔴 fehlt | Erstmal Single-User; später optional Profiles |

---

## 🗓️ Umsetzungsplan

### Phase 1: Funktionierender Prototyp (2 Wochen)
**Ziel:** Ein Bot kann wirklich etwas tun, nicht nur Mock.

- [ ] Echter Bot-Runner mit Tool-Ausführung (Web-Suche, Browser)
- [ ] Bot-Memory (lesen/schreiben in eigenem Ordner)
- [ ] Bot bearbeiten (Edit-Modal)
- [ ] API-Key-Eingabe (Settings-Page, erstmal Plaintext in DB)
- [ ] Scheduling (Cron-basiert)
- [ ] Bot Start/Stop/Pause
- [ ] 3 Templates: Web-Scout, Zusammenfassung, Übersetzer

### Phase 2: Channels & Benachrichtigungen (1 Woche)
**Ziel:** Ergebnisse kommen beim User an.

- [ ] Channel-System Backend (Telegram, E-Mail, Webhook)
- [ ] "Channel hinzufügen" GUI
- [ ] Pro-Bot Channel-Auswahl
- [ ] Channel-Status-Anzeige
- [ ] Desktop-Notifications (erstmal Browser, später Electron)

### Phase 3: Electron Desktop-App (2 Wochen)
**Ziel:** Doppelklick-Installation.

- [ ] Electron Shell + Python Sidecar
- [ ] System Tray
- [ ] Native Notifications
- [ ] First-Run Wizard (API-Key, erster Bot)
- [ ] Installer für Mac + Windows
- [ ] Auto-Updater

### Phase 4: Polish & Launch (1 Woche)
- [ ] Dark Mode
- [ ] Template-Galerie
- [ ] Onboarding-Tour
- [ ] Export/Import
- [ ] Docs / Hilfe-Seite
- [ ] Landing Page

---

## 💡 Entscheidungen die noch offen sind

1. **Bot-Engine**: Eigener LLM-Runner vs. OpenClaw als Engine (subprocess)?
   - Eigener Runner = mehr Kontrolle, weniger Dependencies
   - OpenClaw = sofort alle Tools, Memory, Sessions — aber Dependency
   
2. **WhatsApp**: Business API (Meta-Approval nötig, Kosten) vs. Web-Bridge (grau, fragil)?

3. **Pricing/Modell**: 
   - User bringt eigene API-Keys → kostenlos
   - Hosted Version mit unseren Keys → Abo
   - Hybrid?

4. **Multi-Platform**: Mac + Windows zuerst? Oder Web-Version parallel?
