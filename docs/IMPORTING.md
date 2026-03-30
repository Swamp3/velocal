# Importing Events

The import pipeline fetches event listings from external sources and upserts them into the database. It supports multiple sources — each implements the `ImportSource` interface and can be triggered independently or all at once.

## Sources

### rad-net.de

Scrapes the [rad-net.de](https://www.rad-net.de/rad-net-ausschreibungen.htm) event calendar (German cycling federation).

- Fetches paginated HTML listing pages (up to 30 pages, 1.5s delay between requests)
- Parses event rows with Cheerio (name, date, location, discipline, status, registration deadline, external URL)
- Enriches each event with detail page data (address, precise location name)
- Maps German discipline names to internal slugs (e.g. `Str.` → `strasse`, `CX` → `cyclo-cross`)
- Maps statuses (`ausgeschrieben` → published, `abgesagt` → cancelled, `durchgeführt` → completed)
- Events **do not** include coordinates — geocoding is attempted via `GeocodingService`
- Import can take a while (~45 seconds for 30 pages + detail enrichment)

### my.raceresult.com

Fetches events from the [Race Result](https://my.raceresult.com) JSON API.

- Queries 5 event types (Cycling, Bike Tour, BMX, Cyclocross, MTB) across configured countries
- Type → discipline mapping:

| Type ID | Label      | Discipline Slug |
|---------|-----------|-----------------|
| 11      | Cycling   | `strasse`       |
| 22      | Bike Tour | `breitensport`  |
| 13      | BMX       | `bmx`           |
| 20      | Cyclocross| `cyclo-cross`   |
| 2       | MTB       | `mtb`           |

- **Coordinates included** in the API response — no geocoding needed
- Country configuration via `RACE_RESULT_COUNTRIES` env var (comma-separated numeric codes, default: `276,528` = Germany + Netherlands)
- ~10 requests total (5 types × 2 countries), 1.5s delay between requests
- Import is fast (~15 seconds for 10 JSON requests)
- Events link to `https://my.raceresult.com/{id}/info`

## Triggering an import

There is **no automatic scheduler** — import is triggered manually via the API. Only **admin** users can trigger it (the import controller is protected by both `JwtAuthGuard` and `AdminGuard`).

**Step 1:** Log in as the admin user (default: `admin@velocal.cc` / `admin1234`).

**Step 2:** Trigger the import:

```bash
# Import from rad-net specifically
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{ "source": "rad-net" }'

# Import from race-result specifically
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{ "source": "race-result" }'

# Or run all registered sources (currently rad-net + race-result)
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Response:**

```json
{
  "created": 342,
  "updated": 15,
  "skipped": 8
}
```

- `created` — new events added
- `updated` — existing imported events with changed data
- `skipped` — events already up to date or manually created events that match

## Listing available sources

```bash
curl http://localhost:3000/api/import/sources \
  -H 'Authorization: Bearer eyJhbG...'
```

Returns `["rad-net", "race-result"]`.

## Deduplication

Events are deduplicated across sources:

1. By `externalId` (source-specific, e.g. `rr-385804` for race-result, numeric ID for rad-net)
2. By `externalUrl`
3. By name + date + location combo (catches cross-source duplicates)

Manually created events are never overwritten.

## Rate limiting

To protect against external rate limits, the import has a **cooldown period** (default: 5 minutes). If you trigger an import before the cooldown expires, the API returns `409 Conflict` with the remaining wait time.

- Only one import can run at a time (concurrent requests are rejected)
- Configure via `IMPORT_COOLDOWN_MINUTES` env var

## Notes

- Imported events have `source: "imported"` and an `externalId` / `externalUrl` linking back to the original source
- rad-net events won't have geo-coordinates unless geocoded (rad-net listings don't include lat/lng)
- Race-result events **do** have coordinates directly from the API
- Re-running the import is safe — duplicates are detected and existing data is updated if changed
- There is no frontend UI for triggering imports; use curl, Postman, or any HTTP client
