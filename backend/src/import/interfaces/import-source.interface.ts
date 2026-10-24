import type {
  EventConflict,
  EventSourceRef,
} from '../../events/entities/event.entity';

export interface RawEvent {
  externalId: string;
  sourceName: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  /** False for day-only dates (then stored as midnight Europe/Berlin). Default true. */
  startTimeKnown?: boolean;
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
  /** All sources of the record; name and link are shown publicly. */
  sources?: EventSourceRef[];
  /** Conflicts between sources, for admins. */
  conflicts?: EventConflict[];
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
