/**
 * Value lists as served by `GET /api/events/meta`. The values live only in the backend
 * (`backend/src/events/racing.ts`, `parking.ts`); the browser never repeats them.
 */
export interface RacingMeta {
  classGenders: string[];
  riderGenders: string[];
  classLicenses: string[];
  riderLicenses: string[];
  licenseClasses: { key: string; minAge: number }[];
  categories: { key: string; ageMin: number | null; ageMax: number | null }[];
  championshipLevels: string[];
  seriesKinds: string[];
  formats: { key: string; touring: boolean; discipline: string | null }[];
  touringDiscipline: string;
  kidsMaxAge: number;
  parkingKinds: string[];
  parkingFees: string[];
  maxParkingAreas: number;
}

export type ClassGender = string;
export type ClassLicense = string;
export type LicenseClass = string;
export type ChampionshipLevel = string;
export type EventFormat = string;
export type RiderGender = string;
export type RiderLicense = string;
export type SeriesKind = string;

/** A place where participants (or teams, spectators …) of an event should park. */
export interface ParkingArea {
  id?: string;
  name: string;
  /** One or more of the parking kinds from the meta lists. */
  kinds: string[];
  /** The place to drive to. */
  coordinates: { lat: number; lng: number };
  address?: string | null;
  capacity?: number | null;
  fee?: string | null;
  feeNote?: string | null;
  openFrom?: string | null;
  openUntil?: string | null;
  note?: string | null;
  /** Straight-line distance to the event's place, from the server. */
  distanceM?: number | null;
}
