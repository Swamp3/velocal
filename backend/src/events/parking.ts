/**
 * Parking areas of an event: the lists and limits live here and nowhere else. The browser loads
 * them from `GET /api/events/meta`.
 *
 * An area is a point: the place to drive to (the entrance, or the middle of a small car park),
 * because navigation apps need a point. Large fields are described in the note.
 */

/** Who should park there; an area can serve several (participants and campers together). */
export const PARKING_KINDS = [
  'participants',
  'teams',
  'spectators',
  'accessible',
  'bikes',
  'camper',
] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];

/** Whether parking costs money; null when unknown. */
export const PARKING_FEES = ['free', 'paid'] as const;
export type ParkingFee = (typeof PARKING_FEES)[number];

export const MAX_PARKING_AREAS = 10;

/** An area farther than this from the event's place is probably a mistake (import warning). */
export const PARKING_FAR_METERS = 5000;

/** Straight-line distance in metres between two points (haversine). */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

export function parkingMeta() {
  return {
    parkingKinds: PARKING_KINDS,
    parkingFees: PARKING_FEES,
    maxParkingAreas: MAX_PARKING_AREAS,
  };
}
