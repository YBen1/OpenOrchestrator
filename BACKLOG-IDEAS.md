# openOrchestrator — Ideen-Backlog

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

### Aufwand:
- Zentraler Bot + Deep-Link-Flow: ~1 Tag
- QR-Code-Variante: +2h
- Login Widget: +4h (braucht Domain + HTTPS)
