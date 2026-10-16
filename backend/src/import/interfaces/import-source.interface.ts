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
  /** The page of the source that lists this event. */
  sourceUrl?: string;
  status: string;
}

export interface ImportSource {
  readonly name: string;
  fetch(): Promise<RawEvent[]>;
  /**
   * Whether the last `fetch()` covered everything the source lists. Events that
   * are absent from an incomplete run are not reported as gone.
   */
  readonly lastFetchComplete: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
}
