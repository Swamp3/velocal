# Importing Events from rad-net.de

The import pipeline scrapes event listings from [rad-net.de](https://www.rad-net.de/rad-net-ausschreibungen.htm) (the main German cycling federation event calendar).

## How it works

1. Fetches paginated HTML listing pages from rad-net.de (up to 30 pages, 1.5s delay between requests)
2. Parses event rows with Cheerio (name, date, location, discipline, status, registration deadline, external URL)
3. Maps German discipline names to internal slugs (e.g. `Str.` → `strasse`, `CX` → `cyclo-cross`)
4. Maps statuses (`ausgeschrieben` → published, `abgesagt` → cancelled, `durchgeführt` → completed)
5. Upserts into the database — deduplicates by external ID, external URL, or name+date+location combo
6. Never overwrites manually created events

## Triggering an import

There is **no automatic scheduler** — import is triggered manually via the API. Only **admin** users can trigger it (the import controller is protected by both `JwtAuthGuard` and `AdminGuard`).

**Step 1:** Log in as the admin user (default: `admin@velocal.dev` / `admin1234`).

**Step 2:** Trigger the import:

```bash
# Import from rad-net specifically
curl -X POST http://localhost:3000/api/import/trigger \
  -H 'Authorization: Bearer eyJhbG...' \
  -H 'Content-Type: application/json' \
  -d '{ "source": "rad-net" }'

# Or run all registered sources (currently just rad-net)
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

Returns `["rad-net"]`.

## Rate limiting

To protect against rad-net rate limits, the import has a **cooldown period** (default: 5 minutes). If you trigger an import before the cooldown expires, the API returns `409 Conflict` with the remaining wait time.

- Only one import can run at a time (concurrent requests are rejected)
- Configure via `IMPORT_COOLDOWN_MINUTES` env var

## Notes

- Import can take a while (30 pages × 1.5s delay = up to ~45 seconds)
- Imported events have `source: "imported"` and an `externalId` / `externalUrl` linking back to rad-net.de
- Imported events won't have geo-coordinates unless added later (rad-net listings don't include lat/lng)
- Re-running the import is safe — duplicates are detected and existing data is updated if changed
- There is no frontend UI for triggering imports; use curl, Postman, or any HTTP client
