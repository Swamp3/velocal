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

Import is triggered manually by default, but a cron-based weekly scheduler is available (see [Scheduling](#scheduling-automatic-imports)). Only **admin** users can trigger it (the import controller is protected by both `JwtAuthGuard` and `AdminGuard`).

### Import script (recommended)

The easiest way to run an import is the interactive shell script:

```bash
# Run all sources
./scripts/import.sh

# Run a specific source
./scripts/import.sh race-result
./scripts/import.sh rad-net
```

It prompts for admin credentials, logs in, starts an import job, streams the backend container logs live while polling the job, and prints a summary with created/updated/skipped counts when the job finishes.

Environment variables:

| Variable        | Default                      | Description                                      |
|-----------------|------------------------------|--------------------------------------------------|
| `API_BASE`      | `http://localhost:3000/api`  | Backend API base URL                             |
| `CONTAINER`     | `velocal-backend`            | Docker container for log tailing (skipped if not found locally) |
| `POLL_INTERVAL` | `2`                          | Seconds between job status polls                 |
| `POLL_TIMEOUT`  | `1800`                       | Max seconds to wait for the job to finish        |

Example targeting production with a specific source:

```bash
API_BASE=https://velocal.cc/api CONTAINER=velocal-backend-1 ./scripts/import.sh race-result
```

### curl (manual)

Imports run asynchronously as **jobs**. `POST /import/trigger` returns `202 Accepted` immediately with a `jobId`; poll `GET /import/jobs/:id` until `status` is `completed` or `failed`. This avoids nginx/proxy gateway timeouts on long-running imports (rad-net can take ~45s).

```bash
# Start a job for rad-net
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{ "source": "rad-net" }'

# Start a job for race-result
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

**Trigger response (HTTP 202):**

```json
{
  "id": "b3f1a2c8-...",
  "source": "rad-net",
  "status": "running",
  "startedAt": "2026-04-21T12:00:00.000Z",
  "finishedAt": null,
  "result": null,
  "error": null
}
```

**Poll job status:**

```bash
curl http://localhost:3000/api/import/jobs/b3f1a2c8-... \
  -H 'Authorization: Bearer eyJhbG...'
```

**Completed job:**

```json
{
  "id": "b3f1a2c8-...",
  "source": "rad-net",
  "status": "completed",
  "startedAt": "2026-04-21T12:00:00.000Z",
  "finishedAt": "2026-04-21T12:00:45.000Z",
  "result": { "created": 342, "updated": 15, "skipped": 8 },
  "error": null
}
```

- `status` — `running`, `completed`, or `failed`
- `result.created` — new events added
- `result.updated` — existing imported events with changed data
- `result.skipped` — events already up to date or manually created events that match
- `error` — set when `status` is `failed`

Only the most recent 20 jobs are retained in memory; older job ids return `404`.

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

- Only one import can run at a time; triggering while a job is `running` returns `409`
- Cooldown starts when the previous job finishes (completed or failed)
- Configure via `IMPORT_COOLDOWN_MINUTES` env var

## Notes

- Imported events have `source: "imported"` and an `externalId` / `externalUrl` linking back to the original source
- rad-net events won't have geo-coordinates unless geocoded (rad-net listings don't include lat/lng)
- Race-result events **do** have coordinates directly from the API
- Re-running the import is safe — duplicates are detected and existing data is updated if changed
- There is no frontend UI for triggering imports; use `./scripts/import.sh`, curl, or any HTTP client
