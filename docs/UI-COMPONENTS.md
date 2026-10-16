# UI-Bausteine

Alle wiederkehrenden Bedienelemente kommen aus `frontend/src/app/shared/ui` (Import: `@shared/ui`). Neue Oberflächen verwenden diese Bausteine statt eigener Tailwind-Klassen. Fehlt etwas, wird der Baustein erweitert, nicht in einer Seite nachgebaut.

| Wofür | Baustein | Beispiel |
|---|---|---|
| Schaltfläche mit Text | `ui-button` | `<ui-button variant="outline" (click)="…">Abbrechen</ui-button>` |
| Link oder anderes Element im Button-Look | `uiButton` (Direktive) | `<a uiButton variant="soft" size="sm" [routerLink]="…">Bearbeiten</a>` |
| Schaltfläche nur mit Icon | `uiIconButton` | `<button type="button" uiIconButton icon="delete" [label]="'…' \| transloco" (click)="…"></button>` |
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

**Button** (`variant`): `primary` (Hauptaktion), `secondary`, `outline` (zweite Aktion), `ghost` (zurückhaltend), `danger` (löschen), `soft` (leichte Aktion in Listenzeilen, z. B. „Bearbeiten“), `link` (Text-Link, der etwas auslöst), `quiet` (grauer Text-Link für Nebenaktionen). Größen: `sm`, `md`, `lg`. Die Stile liegen an einer Stelle: `shared/ui/button/button-styles.ts`.

**Icon-Button** (`variant`): `ghost`, `outline`, `soft`, `danger`. `shape`: `round` (Standard) oder `square`. Größen `sm`, `md`, `lg`. `label` ist Pflicht (Screenreader und Tooltip).

**Segmented**: Optionen als `{ value, labelKey, count? }`, `labelKey` ist ein Übersetzungsschlüssel. `size`: `sm` (Standard) oder `md`.

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
