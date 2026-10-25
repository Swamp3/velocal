/**
 * Lists of the racing model as served by `GET /api/events/racing-meta`. The values live only in
 * the backend (`backend/src/events/racing.ts`); the browser never repeats them.
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
}

export type ClassGender = string;
export type ClassLicense = string;
export type LicenseClass = string;
export type ChampionshipLevel = string;
export type EventFormat = string;
export type RiderGender = string;
export type RiderLicense = string;
export type SeriesKind = string;
