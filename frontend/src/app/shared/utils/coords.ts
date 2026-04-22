export interface LatLng {
  lat: number;
  lng: number;
}

type CoordsInput =
  | { lat?: number; lng?: number; type?: string; coordinates?: number[] }
  | null
  | undefined;

/**
 * Normalises the mix of coordinate shapes emitted by the backend into `{ lat, lng }`.
 *
 * Accepts:
 *  - `{ lat, lng }` (frontend-facing shape)
 *  - GeoJSON Point `{ type: 'Point', coordinates: [lng, lat] }` (Postgres raw shape)
 */
export function normalizeCoords(coords: CoordsInput): LatLng | null {
  if (!coords) return null;
  if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return { lat: coords.lat, lng: coords.lng };
  }
  if (coords.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
    return { lat: coords.coordinates[1], lng: coords.coordinates[0] };
  }
  return null;
}
