# UI-Bausteine

Alle wiederkehrenden Bedienelemente kommen aus `frontend/src/app/shared/ui` (Import: `@shared/ui`). Neue Oberflächen verwenden diese Bausteine statt eigener Tailwind-Klassen. Fehlt etwas, wird der Baustein erweitert, nicht in einer Seite nachgebaut.

| Wofür | Baustein | Beispiel |
|---|---|---|
| Schaltfläche mit Text | `ui-button` | `<ui-button variant="outline" (click)="…">Abbrechen</ui-button>` |
| Link oder anderes Element im Button-Look | `uiButton` (Direktive) | `<a uiButton variant="soft" size="sm" [routerLink]="…">Bearbeiten</a>` |
| Schaltfläche nur mit Icon | `uiIconButton` | `<button type="button" uiIconButton icon="delete" [label]="'…' \| transloco" (click)="…"></button>` |
| Weitere Aktionen hinter einem Menü | `ui-action-menu` | `<ui-action-menu [items]="items" [label]="'…' \| transloco" (selected)="run($event)" />` |
| Auswahl „eines von mehreren“ (Tabs, Filter, Zeitraum) | `ui-segmented` | `<ui-segmented [options]="options" [value]="v()" (valueChange)="set($event)" />` |
| Auswählbare Pille (Mehrfachauswahl, z. B. Disziplinen) | `ui-chip` | `<ui-chip [selected]="…" (selectedChange)="…">Straße</ui-chip>` |
| Kleine Statusmarke | `ui-badge` | `<ui-badge variant="success">Dabei</ui-badge>` |
| Fläche für einen Inhaltsblock | `ui-card` | `<ui-card><h2>…</h2>…</ui-card>` |
| Dialog | `ui-modal` | Titel, Inhalt, Fußzeile über `<ng-container footer>` |
| Lösch-Bestätigung | `app-confirm-delete-dialog` | Name eintippen |
| Seitenwechsel | `ui-pagination` | |
| Ladezustand | `ui-skeleton` | |
| Meldung | `ToastService` | |

## Varianten

**Button** (`variant`): `primary` (Hauptaktion), `secondary`, `outline` (zweite Aktion), `ghost` (zurückhaltend), `danger` (löschen), `soft` (leichte Aktion in Listenzeilen, z. B. „Bearbeiten“), `link` (Text-Link, der etwas auslöst), `quiet` (grauer Text-Link für Nebenaktionen), `link-danger` (roter Text-Link). Die Text-Varianten `link`, `quiet` und `link-danger` haben kein Padding; `size="sm"` macht sie klein (12 px). Größen: `sm`, `md`, `lg`. Die Stile liegen an einer Stelle: `shared/ui/button/button-styles.ts`.

**Icon-Button** (`variant`): `ghost`, `outline`, `soft`, `danger`. `shape`: `round` (Standard) oder `square`. Größen `sm`, `md`, `lg`. `label` ist Pflicht (Screenreader und Tooltip). `filled` füllt das Icon für den „An“-Zustand eines Schalters (z. B. Favorit).

**Action-Menu** (`ui-action-menu`): Drei-Punkte-Menü für seltene oder zerstörerische Aktionen. Die ein bis zwei Hauptaktionen einer Seite stehen als Icon-Buttons daneben (Beispiel: Event-Ansicht mit Favorit, Teilen, Bearbeiten und „⋮“ für Löschen). Einträge: `{ id, label, icon?, danger?, disabled? }`.

**Segmented**: Optionen als `{ value, labelKey | label, count? }` (`labelKey` = Übersetzungsschlüssel, `label` = fester Text, z. B. Jahreszahlen oder „50 km“). `size`: `xs`, `sm` (Standard), `md`; `fullWidth` verteilt die Einträge über die ganze Breite.

**Card**: `variant` `raised` (Standard, mit Hintergrund und Schatten) oder `outline` (nur Rahmen); `padding` `none`, `sm`, `md`.

**Chip**: für Auswahl, die man an- und ausschaltet (Disziplinen, Tags, „nur zukünftige“).

## Icons

Icons sind Material Symbols, in einer verkleinerten Schriftdatei (`src/assets/fonts/material-symbols-subset.woff2`). Ein neues Icon, das in der Datei fehlt, erscheint als leeres Kästchen. Nach dem Einbauen neuer Icons:

```
python3 -m venv /tmp/icons && /tmp/icons/bin/pip install fonttools brotli
/tmp/icons/bin/python frontend/scripts/subset-icons.py
```

## Regeln

- Kein `<button class="rounded-… px-… py-…">` und kein `<a class="…px-… py-…">` im Button-Look: `ui-button` oder `uiButton`.
- Icon-Buttons immer mit `label`.
- Farben nur über die CSS-Variablen aus `styles.scss` (`var(--color-…)`), keine festen Farbwerte.
- Beim Einbinden in einer Komponente den Baustein in `imports` eintragen (`ButtonComponent`, `ButtonStyleDirective`, `IconButtonComponent`, `SegmentedComponent`, `CardComponent`).

## Bewusst nicht vereinheitlicht

Diese Elemente sind eigene Bedienelemente mit eigener Logik und bleiben, wie sie sind: Seitenwechsel (`ui-pagination`), Dropdown, Kopfzeilen-Menü, Kalenderzellen und Tagesstreifen, Karten-Overlay, die Zeilen der Benachrichtigungsliste, Karten, die als Ganzes ein Link sind (Event-, Club-, News-Karten), die Kopf-Schaltflächen für Theme und Mobilmenü (eigene SVG-Icons) und der Spenden-Button.
