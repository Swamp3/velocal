# Features

## Event list (`/events`)

- Full-text search by event name
- Filter by discipline, date range and format (licence race, Jedermann, kids' race, RTF, CTF,
  Radmarathon, brevet, gravel ride, tour); the **Breitensport** chip shows all touring rides
- **Fits me** (signed in): events with a class or route the rider may start in, from year of birth,
  gender, licence and licence class in the profile; championships; hide league matchdays
- Geo search by zip code or browser geolocation + radius
- Paginated results

## Event detail (`/events/:id`)

- Full event info (dates, location, status, discipline, registration deadline)
- Mini-map showing event location (if coordinates available)
- External link to source (e.g. rad-net.de, my.raceresult.com); public list of sources
- Rating classes or, for touring events, routes with length and climbing; classes the viewer may
  start in are marked
- Championship level, series membership (cup run, league matchday) and format
- Parking areas (several kinds each, fee, opening times, note) as cards with Google/Apple Maps
  navigation and as "P" markers on the map, with a hint that the details may be wrong
- Events without a start time show the same calendar day in every time zone

## Map view (`/map`)

- All events on a Leaflet map with clustered markers
- Markers colored by discipline
- Click a cluster to zoom, click a marker for event details

## Internationalization

The app supports German (default) and English. Switch locale in the user profile or browser settings.
