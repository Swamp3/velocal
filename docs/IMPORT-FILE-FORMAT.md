# Event import files

How to collect events outside VeloCal and hand them over as a file that an admin imports.
The admin page is **Admin → Imports → Import file**; the command line alternative is
`scripts/import-file.sh` (see [IMPORTING.md](IMPORTING.md)).

## In short

- One **JSON file per source** (collector). Several files can be imported one after another; each
  file is checked and imported on its own.
- Up to **5000 events** and **10 MB** per file. Split larger collections into several files with the
  same `sourceName`, each with `"complete": false`.
- The file is **checked first**. Nothing is saved until the admin imports it.
  - **Errors** block the whole file. The report names the event (`#index`, `externalId`) and field.
  - **Warnings** (for example documented conflicts, a town without venue, a possible duplicate) must
    be confirmed by the admin.
  - **Notes** only explain what happens (for example "no coordinates, the place is looked up").
- Importing the same file again is safe: unchanged events are left alone, changed ones are updated.

## What an import never does

- It never deletes events. With `"complete": true`, upcoming events of the source that are missing
  from the file are only **marked** as "no longer listed" (admins see them under data quality).
- It never changes events created by hand, events of another source, or events of a club.
- It only updates an event that the same `sourceName` imported under the same `externalId`.
- It never overwrites a field that a person edited after the import (for example a corrected start
  time). The report lists such fields as "edited by hand, kept".
- A missing field never clears a stored value. To remove a value, edit the event in VeloCal.
- A record that looks like an existing event of another origin (same day, similar name and place) is
  **not imported** and reported as a possible duplicate. Different classes or rounds at the same
  hall (U13 / U17, Staffel 1 / Staffel 2, Gruppe 1 - 3 / 2 - 4) are not treated as duplicates.

Every run keeps a report (per event: new, changed with old and new value, unchanged, skipped and
why). Admins find it under Admin → Imports → Report, and on each imported event.

## File structure

```json
{
  "sourceName": "velocal-de-research",
  "complete": false,
  "events": [
    {
      "externalId": "weser-ems-cup-cloppenburg-2026",
      "name": "9. Cloppenburger City Cross",
      "startDate": "2026-10-24",
      "disciplineSlug": "cyclo-cross",
      "locationName": "Cloppenburg",
      "country": "DE",
      "status": "published",
      "externalUrl": "https://deutscherradsportnachwuchs.de/event/9-cloppenburger-city-cross/",
      "sourceUrl": "https://radsportverband-niedersachsen.de/events/kategorie/termine-radrennsport/",
      "source": [
        {
          "name": "Radsportverband Niedersachsen",
          "url": "https://radsportverband-niedersachsen.de/events/kategorie/termine-radrennsport/",
          "checkedAt": "2026-10-24"
        }
      ],
      "conflicts": []
    }
  ]
}
```

### File fields

| Field | Required | Rules |
|---|---|---|
| `sourceName` | yes | 3-40 characters: lower-case letters, digits, hyphens. One fixed name per collector. |
| `complete` | no | `true` only when the file lists **every** upcoming event of this source (see above). Default `false`. |
| `events` | yes | 1 to 5000 events. |

### Event fields

| Field | Required | Rules |
|---|---|---|
| `externalId` | yes | Stable id, max. 200 characters, unique in the file. Keep it when date or place change later; never reuse it for another event. |
| `name` | yes | 2-300 characters. Keep class and round in the name (`U13`, `2. Spieltag`, `Staffel 1`). |
| `startDate` | yes | Day only `YYYY-MM-DD` when no time is known, otherwise ISO 8601 **with offset**, e.g. `2026-10-25T09:00:00+01:00`. A time without offset is an error. |
| `endDate` | no | Same format; not before `startDate`. For multi-day events. |
| `startTimeKnown` | no | Optional check: `false` for day-only dates, `true` with a time. A day-only date marked `true` is an error. |
| `allDay` | no | Accepted, currently not used. |
| `disciplineSlug` | yes | `strasse`, `bahn`, `cyclo-cross`, `mtb`, `bmx`, `halle`, `trial`, `breitensport`, `tt`, `gravel` |
| `locationName` | yes | Venue and town, e.g. `73770 Denkendorf, Albert-Schweitzer-Schulsporthalle, Lenaustraße 3`. Placeholders (`TBD`, `Austragungsort nicht angegeben`) or a region alone (`Deutschland`, `Niedersachsen`) are errors; a town with "venue follows" is a warning. |
| `address` | no | Street address, max. 255 characters. |
| `country` | no | Two capital letters, default `DE`. |
| `lat`, `lng` | no | Decimal degrees (WGS84), both or neither. Without them the place is looked up from `locationName`/`address`; places that cannot be found are reported. |
| `registrationDeadline` | no | Same date format as `startDate`. |
| `externalUrl` | no | Full `http(s)` link to the announcement or sign-up page. |
| `sourceUrl` | no | Full `http(s)` link to the page that lists the event. Several events may share it (a calendar or PDF). |
| `status` | yes | `published` (announced), `cancelled` or `completed`. |
| `description` | no | Plain text, max. 10 000 characters. Shown on the event page. |
| `source` | no | List of sources: `{ "name", "url", "checkedAt"?, "updatedAt"? }`. Name and link are shown **publicly** on the event page; `checkedAt`/`updatedAt` (`YYYY-MM-DD`) only to admins. |
| `conflicts` | no | Disagreements between sources: a text, or `{ "field", "values"?, "selectedSource"?, "reason"? }`. Shown **only to admins**; each event with conflicts is a warning to confirm. |

Unknown fields are reported as warnings and ignored.

## How to create a file

1. Pick a `sourceName` for your collection and keep it for all later files.
2. Give every event a stable `externalId` (for example the organiser's id, or
   `<series>-<town>-<year>` for your own keys). This id is how VeloCal finds the event again.
3. Write dates as `YYYY-MM-DD`, or with time and offset. Do not invent times.
4. Put class and round into the name when one hall hosts several competitions on a day; they become
   separate events.
5. List every source you used in `source`, and record disagreements in `conflicts`.
6. Leave out events without a real place or with an unresolved date; collect them in a separate
   review list instead of the import file.
7. Upload the file under Admin → Imports → Import file, read the report, fix errors in the file and
   check again. Import when only confirmed warnings remain.

## Messages

| Code | Kind | Meaning |
|---|---|---|
| `required`, `type`, `tooShort`, `tooLong` | error | Field missing or wrong |
| `duplicateExternalId` | error | Same `externalId` twice in the file |
| `dateInvalid`, `dateNeedsOffset`, `endBeforeStart`, `startTimeKnownMismatch` | error | Date problems |
| `disciplineUnknown`, `statusUnknown`, `countryInvalid`, `urlInvalid` | error | Value not allowed |
| `locationPlaceholder` | error | No real place |
| `coordinatesIncomplete`, `coordinateInvalid` | error | Coordinates |
| `sourceInvalid`, `conflictInvalid` | error | Malformed `source` / `conflicts` entry |
| `unknownField` | warning | Field is ignored |
| `hasConflicts` | warning | Documented conflicts, confirm before importing |
| `locationVague` | warning | Town known, venue not |
| `pastEvent`, `farFuture`, `deadlineAfterStart`, `sameNameSameDay`, `timeIgnored` | warning | Plausibility |
| `possibleDuplicate` | warning | Looks like an existing event of another origin: not imported |
| `markedMissing` | warning | `complete: true` marks missing upcoming events |
| `noCoordinates`, `protectedFields`, `otherSource` | note | What will happen |
| `geocodeFailed`, `saveFailed` | report | Problems during the import itself |
