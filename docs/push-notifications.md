# Push-Benachrichtigungen – Plan

Status: umgesetzt (Web Push mit VAPID, ohne externen Dienst). Dieses Dokument beschreibt Entwurf und Betrieb.

## Einrichtung (einmalig)

1. Schlüssel erzeugen: `cd backend && npx web-push generate-vapid-keys`.
2. In der Produktions-`.env` setzen: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:<erreichbare Adresse>`. Ohne Schlüssel ist Push aus; die Profil-Seite zeigt dann „nicht verfügbar“.
3. Den öffentlichen Schlüssel nie ändern, sonst verlieren alle Geräte ihr Abo.
4. Deployen (Migration `AddPushNotifications` legt `push_subscriptions` und `users.pushPreferences` an; vorher Datenbank sichern).
5. Auf dem iPhone: iOS 16.4+, Seite in Safari öffnen, „Zum Home-Bildschirm“, App von dort starten, Profil → Push-Benachrichtigungen → „Für dieses Gerät aktivieren“, danach „Testnachricht senden“. Push funktioniert nur in der Produktions-Build über HTTPS (der Service Worker ist in `ng serve` aus).

## Abweichungen vom ursprünglichen Plan

- Einstellungen liegen als `users.pushPreferences` (jsonb, `null` = Standardwerte) statt in einer eigenen Tabelle. Vier Gruppen: `invites`, `membership`, `events` (standardmäßig aus), `community`.
- Das Abo wird pro Gerät ein- und ausgeschaltet, die Gruppen gelten pro Konto.
- Zusätzlich gibt es `POST /push/test` (Testnachricht an die eigenen Geräte, 30 s Pause) und `GET /push/config` (öffentlich: Schlüssel und Verfügbarkeit).
- Beim Abmelden wird das Abo des Geräts serverseitig entfernt, damit der nächste Nutzer auf demselben Gerät nichts erhält.
- Beim Start (angemeldet) wird das Abo erneuert, falls der Browser es verloren hat (relevant für iOS).
- Löschungs- und Sperr-Hinweise zeigen auf die Benachrichtigungsliste, weil die Seite des Clubs nicht mehr erreichbar sein kann.

## Cookies / Cookie-Banner

Push selbst braucht **keine Cookies** und kein Banner: Die Einwilligung ist die Berechtigungsabfrage des Browsers plus der ausdrückliche Schalter im Profil. VeloCal setzt generell keine Cookies, sondern nutzt nur localStorage (Anmeldung, Sprache, Design, Filter, Push-Vermerk).

TODO (Cookie-/Einwilligungsbanner prüfen): `PageTrackingService` legt für die Reichweitenmessung eine zufällige Client-ID in localStorage ab (`CLIENT_ID_KEY`). Nach § 25 TDDDG braucht der Zugriff auf Endgerätespeicher eine Einwilligung, sofern er nicht unbedingt erforderlich ist. Reichweitenmessung gilt meist nicht als unbedingt erforderlich. Entweder die Messung ohne Speicherung auf dem Gerät umstellen (z. B. serverseitig, ohne ID) oder ein Einwilligungsbanner einbauen, das die Client-ID erst nach Zustimmung anlegt. Datenschutzerklärung entsprechend anpassen.

TODO (Datenschutzerklärung): Der Abschnitt „E-Mail-Versand“ nennt SendGrid, der Code nutzt aber Resend. Anbieter und Rechtsgrundlage der Übermittlung klären und den Text korrigieren.

## Ziel

Nutzer erhalten ihre bestehenden In-App-Benachrichtigungen (Einladung, Beitrittsanfrage/-entscheidung, neues Event im Club, Club gelöscht/gesperrt) zusätzlich als Push – auf allen Plattformen, auf denen das technisch möglich ist.

## Verfügbarkeit nach Plattform

VeloCal ist bereits eine PWA (Angular Service Worker, Manifest mit `display: standalone`). Der Standardweg ist deshalb **Web Push** (Push API + VAPID, kein Firebase-Konto nötig). Die Zeilen mit „geprüft“ stützen sich auf die Websuche dieser Session, die übrigen auf Vorwissen und müssen vor dem Release auf echten Geräten getestet werden.

| Plattform | Web Push | Bedingung |
|---|---|---|
| Android (Chrome, Edge, Firefox, Samsung Internet) | ja (Vorwissen) | Im Browser oder als installierte PWA, Nutzer erlaubt Benachrichtigungen |
| Windows / Linux / macOS (Chrome, Edge, Firefox) | ja (Vorwissen) | Berechtigung erteilt, Browser muss laufen oder Hintergrunddienst aktiv sein |
| macOS Safari | ja (Vorwissen, Safari 16+) | Berechtigung erteilt |
| iPhone / iPad (iOS/iPadOS 16.4+) | ja, **nur als zum Home-Bildschirm hinzugefügte Web-App** (geprüft: [OneSignal](https://documentation.onesignal.com/docs/ios-web-push), [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)) | Manifest mit passendem `display`, Berechtigungsabfrage nur nach Nutzeraktion; Chrome/Firefox auf iOS nutzen WebKit und unterliegen derselben Regel |
| iOS in der EU | **unklar** | Apple entfernte Home-Bildschirm-Web-Apps in der EU mit iOS 17.4 und kündigte später eine Rückkehr an; Quellen widersprechen sich ([MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [Mobiloud](https://www.mobiloud.com/blog/progressive-web-apps-ios)). Auf echtem EU-Gerät prüfen |
| Native iOS-/Android-App | nur mit nativer Hülle (z. B. Capacitor) und APNs/FCM | Nur nötig, falls iOS-Web-Push in der Praxis zu unzuverlässig ist |

Bekannte Schwäche: Auf iOS laufen Abos teils nach Tagen bis Wochen aus oder gehen verloren ([Webscraft](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en)). Deshalb muss das Abo bei jedem App-Start geprüft und bei Bedarf erneuert werden, und die In-App-Liste bleibt die verlässliche Quelle.

Ergebnis: Mit Web Push erreichen wir Android, alle Desktop-Browser und iPhones mit installierter App. Nutzer auf iOS müssen die App installieren (Hinweis in der UI). Native Apps sind eine spätere Option, kein Teil dieses Plans.

## Technischer Entwurf

### Backend (NestJS)

- Bibliothek `web-push`, VAPID-Schlüssel per Umgebungsvariablen `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`). Fehlen sie, ist Push aus (wie beim Mailversand).
- Neue Tabelle `push_subscriptions`: `id`, `user_id` (FK, CASCADE), `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`, `last_success_at`, `failure_count`.
- Neue Tabelle oder Spalte für Einstellungen: pro Nutzer und Benachrichtigungstyp Push an/aus (Standard: an für Einladung, Beitrittsentscheidung, Sperrung/Löschung; aus für „neues Event“, weil das laut sein kann).
- Endpunkte (JWT): `GET /push/public-key`, `POST /push/subscriptions`, `DELETE /push/subscriptions` (per Endpoint), `GET/PATCH /push/preferences`.
- Auslösung zentral in `NotificationsService.insertMany`: nach dem Einfügen der Benachrichtigungen asynchron Push senden, ohne die Anfrage zu blockieren und ohne dass ein Fehler die eigentliche Aktion scheitern lässt.
- Antworten 404/410 vom Push-Dienst löschen das Abo; wiederholte andere Fehler erhöhen `failure_count`, ab einem Grenzwert wird gelöscht. Gesperrte Nutzer werden nicht angeschrieben.
- Nutzlast klein und ohne Privates: Titel, kurzer Text, Ziel-URL, `tag` zum Zusammenfassen. Format wie vom Angular Service Worker erwartet (`{ notification: { title, body, icon, data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url } } } } }`), damit `ngsw-worker.js` Anzeige und Klick ohne eigenen Service-Worker-Code übernimmt.
- Text in der Sprache des Nutzers (`preferredLanguage`), serverseitig gerendert, da der Service Worker keine Übersetzungen hat.
- Audit-Log nicht nötig; Metriken: gesendet/fehlgeschlagen/entfernt im Log.

### Frontend (Angular)

- `SwPush` aus `@angular/service-worker`: `isEnabled`, `requestSubscription({ serverPublicKey })`, `subscription`, `notificationClicks`.
- Neuer `PushService`: Status (`unsupported`, `needs-install` auf iOS im Browser-Tab, `denied`, `off`, `on`), aktivieren, deaktivieren, Abo bei jedem Start gegen den Server abgleichen und erneuern.
- Einstellungen im Profil: Schalter „Push-Benachrichtigungen“, je Typ ein Schalter, Status-/Hilfetext (blockiert im Browser, iOS: „Zum Home-Bildschirm hinzufügen“). Die Berechtigungsabfrage kommt nur nach Klick auf den Schalter, nie automatisch.
- Dezenter Hinweis im Benachrichtigungs-Posteingang, wenn Push verfügbar, aber aus ist. Texte in `en.json` und `de.json`.
- Manifest: Maskable-Icon ergänzen, `apple-touch-icon` ist vorhanden.

### Datenschutz und Betrieb

- Einwilligung ist die Berechtigungsabfrage des Browsers plus der ausdrückliche Schalter; Datenschutzerklärung um Push (Anbieter der Push-Dienste: Google, Mozilla, Apple, Microsoft erhalten verschlüsselte Nachrichten und den Endpoint) ergänzen.
- Abo-Daten werden beim Löschen des Kontos über CASCADE entfernt.
- Deployment: Schlüssel einmal mit `npx web-push generate-vapid-keys` erzeugen und in der Produktions-Umgebung setzen; der öffentliche Schlüssel darf sich nie ändern, sonst verlieren alle Nutzer ihr Abo.

## Umsetzung in Schritten

1. Backend: Migration, Entität, `PushService`, Endpunkte, Hook in `insertMany`, Tests mit gemocktem `web-push`.
2. Frontend: `PushService`, Profil-Einstellungen, Statushinweise, i18n.
3. Test auf echten Geräten: Android Chrome und Firefox, Windows Chrome/Edge, macOS Safari, iPhone mit installierter App (außerhalb und, falls möglich, innerhalb der EU), Abo-Erneuerung nach Tagen, Sperren/Löschen des Abos.
4. Datenschutzerklärung, Dokumentation, Changelog.
5. Optional später: Event-Erinnerungen (braucht einen Planer), native Hülle für iOS, falls Web Push dort zu unzuverlässig bleibt.

## Offene Entscheidungen

- Welche Benachrichtigungstypen sind standardmäßig an?
- Soll es später Erinnerungen vor Events geben (eigenes Feature)?
- Sind iPhone-Nutzer in der EU wichtig genug, um bei Problemen eine native App zu erwägen?
