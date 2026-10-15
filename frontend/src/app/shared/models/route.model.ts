export interface RouteFile {
  id: string;
  label: string;
  sizeBytes: number;
  distanceM: number | null;
  ascentM: number | null;
  /** [minLat, minLon, maxLat, maxLon]; for the map preview that comes later. */
  bounds: [number, number, number, number] | null;
}

export interface Route {
  id: string;
  name: string;
  description: string | null;
  canEdit: boolean;
  totalDistanceM: number | null;
  files: RouteFile[];
  createdAt: string;
}

export type PaceCategory = 'social' | 'endurance' | 'training' | 'dropride' | 'race';

export const PACE_CATEGORIES: PaceCategory[] = [
  'social',
  'endurance',
  'training',
  'dropride',
  'race',
];

export interface StravaLink {
  id?: string;
  url: string;
  label?: string | null;
}

export interface PaceGroup {
  id: string;
  name: string;
  category: PaceCategory;
  speedMinKmh: number;
  speedMaxKmh: number;
  route: Route | null;
  stravaLinks: StravaLink[];
}

export interface PaceGroupInput {
  name: string;
  category: PaceCategory;
  speedMinKmh: number;
  speedMaxKmh: number;
  routeId?: string | null;
  stravaLinks?: { url: string; label?: string }[];
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '';
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}
