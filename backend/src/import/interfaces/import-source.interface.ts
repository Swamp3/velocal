export interface RawEvent {
  externalId: string;
  sourceName: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  disciplineSlug: string;
  locationName: string;
  address?: string;
  country?: string;
  lat?: number;
  lng?: number;
  registrationDeadline?: Date;
  externalUrl?: string;
  status: string;
}

export interface ImportSource {
  readonly name: string;
  fetch(): Promise<RawEvent[]>;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}
