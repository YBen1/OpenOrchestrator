# openOrchestrator — Ideen-Backlog

## ⚡ Projektprinzipien

> **Usability und Robustheit haben höchste Priorität.**
> 
> - Jedes Feature muss für Nicht-Techniker (Ü60) verständlich sein
> - Lieber weniger Features die bombenfest funktionieren als viele halbgare
> - Error-States müssen dem User klar sagen was passiert ist UND was er tun kann
> - Kein Feature darf die App zum Absturz bringen — graceful degradation immer
> - "Gemütlich" > "Mächtig" — die App soll sich anfühlen wie ein freundlicher Assistent, nicht wie ein DevOps-Dashboard

---

Konzepte & Features die noch durchdacht werden müssen, bevor sie ins Hauptbacklog kommen.

---

## 1. Telegram Zero-Friction Anbindung

**Problem:** Aktuell muss der User selbst einen Telegram-Bot über @BotFather erstellen, Token kopieren, dem Bot eine Nachricht schreiben, dann in der App den Token einfügen und "Chat suchen" klicken. Das sind 6+ Schritte — zu viel für Ü60-User.

**Ziel:** User klickt "Telegram verbinden" → fertig. Maximal 2 Klicks.

### Option A: Eigener zentraler Telegram-Bot
- openOrchestrator betreibt EINEN zentralen Bot (z.B. `@OpenOrchBot`)
- User klickt in der App auf "Telegram verbinden"
- App zeigt einen Deep-Link: `https://t.me/OpenOrchBot?start=<unique_token>`
- User klickt → Telegram öffnet sich → User drückt "Start"
- Bot empfängt das `/start <unique_token>` → verknüpft die chat_id mit dem User
- App pollt im Hintergrund auf Bestätigung → "✅ Verbunden!"

**Vorteile:**
- Null Konfiguration für den User
- Kein BotFather, kein Token, kein Copy-Paste
- Ein Klick + "Start" auf Telegram

**Nachteile:**
- Wir brauchen einen Server der den Bot hostet (oder unseren eigenen Backend-Service)
- Alle User-Nachrichten laufen über unseren Bot → Privacy-Bedenken
- Bei Desktop-App: Bot-Server muss irgendwo laufen (Cloud-Dependency)

**Technisch:**
```
App → generiert unique_token → zeigt t.me/OpenOrchBot?start=<token>
User klickt → Telegram öffnet → /start <token>
Bot-Server empfängt → speichert chat_id + token in DB
App pollt /api/channels/telegram/check-link?token=<token>
→ returns {connected: true, chat_id: "123", name: "Ben"}
App speichert Channel automatisch
```

### Option B: QR-Code mit Deep-Link
- Gleich wie Option A, aber statt Link ein QR-Code in der App
- User scannt mit Handy → Telegram öffnet → "Start"
- Besonders gut für Desktop-App (QR auf Bildschirm, Scan mit Handy)

### Option C: Telegram Login Widget
- Telegram bietet ein [Login Widget](https://core.telegram.org/widgets/login)
- User klickt "Mit Telegram einloggen" → Popup → autorisiert
- Wir bekommen user_id, name, photo
- Dann schicken wir über unseren Bot an diese user_id
- **Braucht trotzdem einen eigenen Bot** (für den Login Widget + zum Senden)

### Option D: Hybrid — Einfacher Wizard + Fallback
- Default: Option A (zentraler Bot, ein Klick)
- Advanced: "Eigenen Bot verwenden" → aktueller BotFather-Flow
- Power-User können eigenen Bot nutzen, Normal-User nehmen den zentralen

### Empfehlung: Option D (Hybrid)
1. **MVP**: Zentraler Bot mit Deep-Link (Option A). Einfachster User-Flow.
2. **Advanced-Modus**: Eigener Bot für Power-User (aktueller Flow).
3. **Desktop**: QR-Code-Variante zusätzlich (Option B).

### Offene Fragen:
- [ ] Bot-Server: Wo hosten? Eigener Service oder in die App eingebaut?
  - Desktop-App: Bot-Server müsste als Cloud-Service laufen → Dependency
  - Oder: Bot läuft lokal in der App, braucht aber öffentliche URL (ngrok/Webhook?)
  - Oder: Long-Polling statt Webhook → kein öffentlicher Server nötig ✅
- [ ] Privacy: Nachricht wird über unseren Bot gesendet. Acceptable?
- [ ] Rate Limits: Ein Bot für alle User → Telegram limitiert auf 30 msg/s global
- [ ] Branding: Bot-Name, Avatar, Beschreibung
- [ ] Multi-User: Wie trennen wir die User? Token-basierte Verknüpfung
- [ ] Was passiert wenn User den Bot blockt? Graceful error + Retry-Hinweis

### UX-Konzept: "Gemütlicher" Telegram-Flow

Der Wizard soll sich anfühlen wie ein Gespräch, nicht wie ein Formular.

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  📱  Telegram verbinden                                       │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │   Ich schicke dir Bot-Ergebnisse direkt                │   │
│  │   auf dein Handy.                                      │   │
│  │                                                        │   │
│  │   Das geht in 30 Sekunden:                             │   │
│  │                                                        │   │
│  │   ① Klicke auf den Button unten                        │   │
│  │   ② Telegram öffnet sich                               │   │
│  │   ③ Drücke dort „Starten"                              │   │
│  │   ④ Fertig! 🎉                                        │   │
│  │                                                        │   │
│  │         [ 📱 Telegram öffnen ]                         │   │
│  │                                                        │   │
│  │   ⏳ Warte auf Verbindung...                           │   │
│  │   (Ich erkenne automatisch wenn du dich verbindest)    │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  💡 Du benutzt kein Telegram?                                 │
│     Kein Problem — deine Ergebnisse sind immer in der App.    │
│                                                                │
│  🔧 Fortgeschritten: Eigenen Bot verwenden                    │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**Nach erfolgreicher Verbindung:**
```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  ✅  Telegram verbunden!                                      │
│                                                                │
│  Ich schicke dir ab jetzt Ergebnisse an:                      │
│  📱 Ben (@benyavor)                                           │
│                                                                │
│  Du kannst für jeden Bot einzeln einstellen,                  │
│  ob er dir auf Telegram schreiben soll.                       │
│                                                                │
│         [ ✨ Super, weiter! ]                                 │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**Robustheit-Checks:**
- Polling-Timeout nach 2 Minuten → "Hmm, hat noch nicht geklappt. Versuch es nochmal?" mit neuem Button
- Telegram-API nicht erreichbar → "Telegram ist gerade nicht erreichbar. Versuch es später nochmal."
- Bot wurde geblockt → "Du hast den Bot auf Telegram blockiert. Öffne Telegram und entsperre ihn."
- Doppelte Verbindung → "Du bist bereits verbunden! Möchtest du die Verbindung erneuern?"

### Aufwand:
- Zentraler Bot + Deep-Link-Flow: ~1 Tag
- QR-Code-Variante: +2h
- Login Widget: +4h (braucht Domain + HTTPS)
- "Gemütlicher" Wizard mit allen Error-States: +4h

---

## 2. Hype-Generierung & Go-to-Market

### Phase 1: Pre-Launch (Jetzt → Electron-Release)

**Landing Page (openorchestrator.ai):**
- Hero mit klarem Value Prop: "Deine KI-Bots. Dein Computer. Keine Cloud."
- Animierter Screenshot/Demo-Video
- E-Mail-Waitlist ("Benachrichtige mich zum Launch") → Hype + Lead-Sammlung
- Open Source Badge (GitHub-Stars als Social Proof)
- "Built in Germany" / Privacy-Angle → starker Differentiator

**Community-Building:**
- GitHub-Repo public machen → README mit GIFs, Screenshots, klarem Pitch
- r/selfhosted, r/LocalLLaMA, r/artificial Posts — diese Communities lieben "local-first AI"
- Hacker News "Show HN" Post zum Launch
- Product Hunt Launch (gut vorbereiten, Upvotes am ersten Tag entscheidend)
- Discord/Telegram Community aufmachen für Early Adopters

**Content:**
- 2-3 Blog Posts / Tutorials: "Wie ich meinen eigenen eBay-Scout gebaut habe (ohne zu coden)"
- YouTube: Kurzes Demo-Video (2-3 Min) — zeigen wie einfach Bot-Erstellung ist
- Twitter/X Thread: "I built a desktop app that lets anyone create AI bots" → virale Threads funktionieren

### Phase 2: Launch

**Launch-Kanäle (Priorität):**
1. **Hacker News** — "Show HN: openOrchestrator – Desktop app to create AI bots without coding"
2. **Product Hunt** — Gut getimtes Launch mit Assets
3. **Reddit** — r/selfhosted, r/LocalLLaMA, r/ChatGPT, r/artificial
4. **Twitter/X** — Thread + Demo-GIF
5. **YouTube** — 5min Tutorial
6. **Dev.to / Medium** — Technischer Deep-Dive

**Multiplikatoren:**
- AI-Newsletter (Ben's Bites, The Rundown AI, TLDR AI)
- YouTuber im AI-Space kontaktieren für Review
- Micro-Influencer auf Twitter die über AI-Tools posten

### Phase 3: Wachstum

**Viraler Loop:**
- "Made with openOrchestrator" Badge in Bot-Outputs (optional)
- Template-Sharing: User erstellen Bot-Templates → teilen auf Community
- "Bot of the Week" Feature auf der Website

**SEO:**
- Blog mit Use-Cases: "Best AI bot for monitoring eBay deals", "Automate support emails with AI"
- Jeder Use-Case = eigene Landing Page
- "openOrchestrator vs Zapier", "openOrchestrator vs n8n" Vergleichsseiten

---

## 3. Monetarisierung

### Strategie: Open Core + Hosted Service

**Kostenlos (Open Source / Desktop App):**
- Alles was jetzt da ist
- BYOK (Bring Your Own Key)
- Unbegrenzte Bots, Pipelines, lokale Ausführung
- Community Support (GitHub Issues, Discord)

**Pro (Bezahlt, ~$9-19/Monat):**
- **Hosted Version** (app.openorchestrator.ai) — keine Installation nötig
- Cloud-Ausführung (Bots laufen auf unserem Server, auch wenn PC aus ist)
- Managed API-Keys (wir rechnen Token ab, User braucht keine eigenen Keys)
- Priority Support
- Erweiterte Templates
- Team-Features (mehrere User, Bot-Sharing)

**Enterprise (Custom Pricing):**
- Self-Hosted mit Support-Vertrag
- SSO/LDAP
- Custom Integrationen
- SLA

### Revenue Streams:

| Stream | Modell | Zielgruppe |
|--------|--------|------------|
| Hosted SaaS | Abo $9-19/mo | Non-tech User die nicht installieren wollen |
| Managed Keys | Usage-based Markup (~30% auf Token-Kosten) | User die keine eigenen API-Keys wollen |
| Templates Marketplace | Revenue Share 70/30 | Template-Creator Community |
| Enterprise | Custom | Firmen |

### Kosten-Kalkulation Hosted:
- Hetzner Cloud CX31: ~€13/mo (ausreichend für ~50 concurrent User)
- Anthropic/OpenAI API: Durchgereicht mit ~30% Markup
- Domain + SSL: Schon vorhanden
- **Break-even bei ~3-5 zahlenden Usern**

### Quick Wins für Revenue:
1. **Waitlist mit Paid Early Access** — $5 Lifetime für die ersten 100 User (Hype + Validation)
2. **"Buy me a coffee"** auf GitHub — Low-friction Donations
3. **GitHub Sponsors** — Monatliche Supporter
4. **Managed Keys** als erstes Paid Feature — einfachster Mehrwert (User braucht keinen OpenAI Account)

### Pricing Psychology:
- Kostenlos muss sich wertig anfühlen (kein "crippled free tier")
- Pro muss echten Mehrwert bieten (Cloud-Ausführung = Killer-Feature)
- "Für immer kostenlos für Selbst-Hoster" → Community-Goodwill
- Yearly Discount: 2 Monate gratis bei Jahreszahlung

---

## 4. Bot-Erstellung überdenken

**Problem:** Der aktuelle Flow zum Anlegen eines Bots ist zu technisch. User muss Modell wählen, Prompt schreiben, Tools konfigurieren, Schedule setzen — alles auf einmal. Das überfordert Nicht-Techniker.

**Zu klären:**
- [ ] Wizard vs. Single-Page? (Schritt-für-Schritt vs. alles auf einmal)
- [ ] Wie viel soll der User entscheiden vs. wie viel wählen wir automatisch?
- [ ] Soll die KI beim Prompt helfen? ("Beschreib was dein Bot tun soll" → wir generieren den System-Prompt)
- [ ] Templates als Startpunkt vs. leere Maske
- [ ] Minimale Pflichtfelder: Name + Aufgabenbeschreibung, Rest optional mit sinnvollen Defaults
- [ ] Modellauswahl: Braucht der User das überhaupt? Oder automatisch "bestes verfügbares Modell"?
- [ ] Tool-Auswahl: Automatisch basierend auf Aufgabe vorschlagen?
- [ ] Schedule: Natürliche Sprache ("Jeden Morgen um 9") statt Cron-Ausdruck?
- [ ] Preview/Test-Run vor dem Speichern?
- [ ] Mobile-friendly? (Bot unterwegs erstellen)

**Ziel:** User beschreibt in 1-2 Sätzen was der Bot tun soll → openOrchestrator konfiguriert den Rest. Wie ein Gespräch, nicht wie ein Formular.

---

### Offene Fragen:
- [ ] Firma gründen? (UG für Rechnungsstellung)
- [ ] Payment Provider: Stripe? Paddle? (Paddle = einfacher für EU/Steuern)
- [ ] Terms of Service / Privacy Policy für gehostete Version
- [ ] DSGVO: Hosted Version verarbeitet User-Daten → AVV nötig
- [ ] Wie viel Infrastruktur-Overhead wollen wir managen?
