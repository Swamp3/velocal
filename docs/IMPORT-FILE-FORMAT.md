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
| `startDate` | yes | Day only `YYYY-MM-DD` when no time is known, otherwise ISO 8601 **with offset**, e.g. `2026-10-25T09:00:00+01:00`. A time without offset is an error. A day-only date is stored as midnight in Germany and shown as that calendar day in every time zone. |
| `endDate` | no | Same format; not before `startDate`. For multi-day events. |
| `startTimeKnown` | no | Optional check: `false` for day-only dates, `true` with a time. A day-only date marked `true` is an error. |
| `allDay` | no | Accepted, currently not used. |
| `disciplineSlug` | yes | `strasse`, `bahn`, `cyclo-cross`, `mtb`, `bmx`, `halle`, `trial`, `breitensport`, `tt`, `gravel`. Use `breitensport` only when the bike type is unknown; see [Formats](#formats). |
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
| `championship` | no | Championship level of the whole event: `club`, `district`, `state`, `regional`, `national`, `continental`, `world`. |
| `format` | no | What kind of event it is, see [Formats](#formats). When neither the file nor the stored event has one, it is taken from a clear name (`RTF`, `CTF`, `Radmarathon`, `Brevet`, `ARA …`, `Jedermann`, `Gran Fondo`, `Gravel Ride`, `Fette Reifen`, `Laufradrennen`, `Kinderrennen`). A stored format is never replaced by a guess. |
| `classes` | no | Rating classes (Wertungsklassen) or routes, see below. When given, they replace the stored classes. |
| `series` | no | Series the event belongs to: one object or a list, see below. |
| `parking` | no | Parking areas, see [Parking](#parking-parking). When given, they replace the stored ones. |

Unknown fields are reported as warnings and ignored.

All allowed values (disciplines aside) are defined once, in `backend/src/events/racing.ts`, and
served to the app at `GET /api/events/meta`. The tables below describe them.

### Formats

| `format` | Meaning | Timing | Who may start | Discipline for `breitensport` |
|---|---|---|---|---|
| `race` | Licence race (Lizenzrennen), Hobby races included | yes | As the classes say (licence, day licence, Hobby) | – |
| `jedermann` | Jedermann race, Gran Fondo | yes | Everyone without licence; licensed riders often only of some licence classes or ranked separately | – |
| `kids` | Kids' races: Fette-Reifen-Rennen (own bike, tyres from 30 mm, no road bikes), Laufradrennen, Bambini | mostly yes | Children without a licence; usually helmet and parental consent | – |
| `rtf` | Radtourenfahrt: signposted road routes of 20–199 km with checkpoints | no | Everyone | `strasse` |
| `ctf` | Country-Tourenfahrt: off-road routes for MTB and cross bikes | no | Everyone | `mtb` (set `gravel` when it is a gravel CTF) |
| `marathon` | Radmarathon: road routes of 200 km and more | no | Everyone | `strasse` |
| `brevet` | Randonneur ride (Audax, ARA/ACP: 200/300/400/600 km) with a time limit | no (time limit only) | Everyone | `strasse` |
| `gravel_ride` | Gravel tour | no | Everyone | `gravel` |
| `tour` | Radwandern, Volksradfahren, club tours | no | Everyone | stays `breitensport` |

**Discipline and format.** The discipline says which bike and terrain (Straße, MTB, Gravel …), the
format what kind of event. `breitensport` is only for recreational events whose bike type is
unknown: an event with `disciplineSlug: "breitensport"` and a known format gets the discipline of
the last column. In the app, the **Breitensport** filter shows all touring formats (`rtf` to
`tour`) whatever their discipline, plus the remaining `breitensport` events.

**Routes.** Touring formats list their routes as `classes`: one entry per route with `name`,
`distanceKm`, `elevationM`, `startTime` (start window opens) and, if needed, `ageMin` and a `note`
("under 18 only with parental consent"). A touring event without routes counts as open to everyone
in the "Fits me" filter.

```json
{ "externalId": "rtf-kahler-asten-2026", "name": "RTF Rund um den Kahlen Asten", "format": "rtf",
  "disciplineSlug": "strasse",
  "classes": [
    { "name": "Familienstrecke", "distanceKm": 42, "elevationM": 450 },
    { "name": "Strecke 3", "distanceKm": 153, "elevationM": 2300, "ageMin": 16, "startTime": "2027-05-16T07:00:00+02:00" }
  ] }
```

**Kids' races.** A kids' race is its own event with `"format": "kids"` and classes such as
`{ "name": "Laufrad", "category": "u7" }` or
`{ "name": "Fette Reifen U9", "category": "u9", "license": "unlicensed" }`. When it runs alongside
an RTF or race, add it as a class of that event instead (`ageMax` of 12 or less): the "Kids'
races" filter finds both. Without classes, a kids' race fits children without a licence.

**Jedermann.** An `open` class with `licenseClasses` admits everyone without a licence plus licensed
riders of those classes:

```json
"classes": [
  { "name": "Jedermann Herren 30–39", "gender": "male", "ageMin": 30, "ageMax": 39, "licenseClasses": ["amateur", "master"] }
]
```

### Rating classes and routes (`classes`)

One entry per class with its own result list, or per route of a touring event. Riders can filter
for classes they may start in ("Fits me", using year of birth, gender, licence and licence class
from their profile); the event page marks the fitting classes.

```json
"classes": [
  { "name": "U15 männlich", "gender": "male", "category": "u15", "license": "license", "startTime": "2026-11-14T10:00:00+01:00" },
  { "name": "Elite Frauen", "gender": "female", "ageMin": 19, "license": "license", "licenseClasses": ["elite_amateur"], "championship": "state" },
  { "name": "Amateure / Masters", "license": "license", "dayLicense": true, "licenseClasses": ["amateur", "master"] },
  { "name": "Hobby", "license": "unlicensed", "ageMin": 17 },
  { "name": "Jedermann", "license": "open" }
]
```

| Field | Required | Rules |
|---|---|---|
| `name` | yes | Max. 120 characters, as the organiser names the class or route. |
| `gender` | no | `open` (default), `male`, `female`. |
| `category` | no | Age category, see the table below; fills `ageMin`/`ageMax` when they are missing (given ages win). |
| `ageMin`, `ageMax` | no | Whole years, inclusive. Cycling counts by **year of birth**: the age reached in the event's year (U15 = 13 and 14, U23 = 19 to 22). |
| `license` | no | Who may start: `open` (default; everyone), `unlicensed` (Hobby: only riders **without** a licence), `license` (needs a federation licence such as BDR), `uci` (needs a UCI licence). |
| `dayLicense` | no | `true` when riders without a licence may start in a `license` class with a day licence (BDR: up to five per year). |
| `licenseClasses` | no | For `open`, `license` and `uci` classes: licence classes that may start (`elite_amateur`, `amateur`, `master`). Missing or empty: all. Youth licences have no licence class, so this list does not exclude them. |
| `distanceKm` | no | Length in km (one decimal). |
| `elevationM` | no | Climbing in metres. |
| `startTime` | no | ISO 8601 with offset. |
| `championship` | no | Championship level of this class only. |
| `note` | no | Max. 300 characters. |

Several competitions at one hall on one day (U13 and U17 matchdays) stay **separate events**, each
with its own class. One race with several classes is **one event** with several classes.

**Age categories** (BDR/UCI; age reached in the calendar year):

| `category` | Ages | Note |
|---|---|---|
| `u7` | up to 6 | Kids (balance bike) |
| `u9` | 7–8 | Kids |
| `u11` | 9–10 | Youth |
| `u13` | 11–12 | Youth |
| `u15` | 13–14 | Youth |
| `u17` | 15–16 | Youth |
| `u19` | 17–18 | Juniors |
| `u23` | 19–22 | Licensed riders in their licence class |
| `elite` | 23–29 | |
| `masters1` | 30–39 | From 30 a licensed rider may choose a Masters licence |
| `masters2` | 40–49 | |
| `masters3` | 50–59 | |
| `masters4` | 60+ | |

**Licence classes** of licensed adults (BDR since 2019), with the age from which a rider can hold
them: `elite_amateur` (19+; the best riders of the ranking, Bundesliga riders), `amateur` (19+;
all others), `master` (30+, by choice). UCI licences belong to riders of UCI teams.

### Parking (`parking`)

Where participants, teams or spectators should park. Shown **publicly** on the event page and map
with a note that the details may be wrong; each area links to Google and Apple Maps navigation.
An area is a **point**: the place to drive to (the entrance, or the middle of a small car park).
Describe large fields in `note`.

```json
"parking": [
  { "name": "Wiese am Main", "kinds": ["participants", "camper"], "lat": 50.1090, "lng": 8.6840, "fee": "free", "openFrom": "07:00", "note": "Zufahrt über die Lindenstraße" },
  { "name": "Teamparkplatz", "kinds": ["teams", "accessible"], "lat": 50.1082, "lng": 8.6812, "capacity": 20 }
]
```

| Field | Required | Rules |
|---|---|---|
| `name` | yes | Max. 80 characters. |
| `kinds` | yes | One or more of `participants`, `teams` (team cars and buses), `spectators`, `accessible`, `bikes`, `camper`. |
| `lat`, `lng` | yes | Decimal degrees of the entrance. More than 5 km from the event's `lat`/`lng` is a warning. |
| `address` | no | Max. 255 characters. |
| `capacity` | no | Rough number of spaces, whole number from 1. |
| `fee` | no | `free` or `paid`; missing means unknown. |
| `feeNote` | no | Max. 80 characters, e.g. `5 € pro Tag`. |
| `openFrom`, `openUntil` | no | `HH:mm` on the event day. |
| `note` | no | Max. 300 characters. |

At most 10 areas per event. Areas edited by hand in VeloCal are kept by later imports.

### Series (`series`)

Links the event to a series. VeloCal creates the series on first import and finds it again by
`sourceName` + `key`; later files update its name, kind and season. Series created by hand are
never changed by an import.

```json
"series": { "key": "gunsha-cross-challenge-2026-27", "name": "GUNSHA Cross Challenge", "kind": "cup", "season": "2026/27", "round": 3 }
```

| Field | Required | Rules |
|---|---|---|
| `key` | yes | Stable key within your source, max. 200 characters. |
| `name` | yes | Max. 200 characters. |
| `kind` | no | `cup` (runs counting for one ranking: Cup, Challenge, Bundesliga in cross), `league` (matchdays of a league season, e.g. Radball), `series` (default, anything else). |
| `season` | no | E.g. `2026/27` or `2027`. |
| `round` | no | Number of the run or matchday, from 1. |
| `roundLabel` | no | Text such as `2. Spieltag` or `Gruppe 1 - 3`. |

Championships are not a series: set `championship` on the event or the class. Tournaments (Pokal)
without a ranking across events are plain events.

Visitors can hide league matchdays in the event list ("Hide league matchdays") and filter for
championships.

### Adding series and classes to an existing file

`scripts/enrich-import.py in.json out.json` adds `series` (Radball leagues from
`Radball — <league> — <matchday>`, and known cyclo-cross cups) and age classes (U11-U19, Frauen)
from names and ids. It writes a new file; check its result in the admin page before importing.

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
| `championshipUnknown`, `classInvalid`, `classGenderUnknown`, `classLicenseUnknown`, `classLicenseClassUnknown`, `classCategoryUnknown`, `ageInvalid`, `ageRange`, `numberInvalid` | error | Class entry wrong |
| `formatUnknown` | error | `format` is not one of the formats |
| `parkingInvalid`, `parkingTooMany`, `parkingKindUnknown`, `parkingFeeUnknown`, `timeInvalid` | error | Parking entry wrong |
| `parkingFar` | warning | A parking area is more than 5 km from the event |
| `seriesInvalid`, `seriesKindUnknown`, `roundInvalid` | error | Series entry wrong |
| `seriesSummary` | note | How many series the file names and how many are new |
| `possibleDuplicate` | warning | Looks like an existing event of another origin: not imported |
| `markedMissing` | warning | `complete: true` marks missing upcoming events |
| `noCoordinates`, `protectedFields`, `otherSource` | note | What will happen |
| `geocodeFailed`, `saveFailed` | report | Problems during the import itself |
