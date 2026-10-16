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

Erledigt: Die Reichweitenmessung legt keine Client-ID mehr im localStorage ab. Die zufällige Besuchs-ID lebt nur im Arbeitsspeicher (neue ID pro Seitenaufruf), das Konto wird nicht mehr gespeichert, Seitenaufrufe werden nach 400 Tagen gelöscht. Damit greift VeloCal nicht auf Endgerätespeicher für Messzwecke zu und braucht kein Einwilligungsbanner. Sollte später ein Dienst eingebunden werden, der Cookies oder Gerätespeicher zu Messzwecken nutzt, ist vorher ein Banner nötig (§ 25 TDDDG).

Erledigt: Der Abschnitt „E-Mail-Versand“ der Datenschutzerklärung nennt jetzt Resend statt SendGrid.
