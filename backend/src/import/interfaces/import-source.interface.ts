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
  /** Rating classes; replaces the stored classes when given. */
  classes?: RawEventClass[];
  championship?: string;
  /** Series the event belongs to (cup run, league matchday). */
  series?: RawEventSeries[];
}

export interface RawEventClass {
  name: string;
  gender: 'open' | 'male' | 'female';
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  license: 'open' | 'unlicensed' | 'license' | 'uci';
  dayLicense: boolean;
  licenseClasses: ('elite_amateur' | 'amateur' | 'master')[] | null;
  startTime: Date | null;
  championship: string | null;
  note: string | null;
}

export interface RawEventSeries {
  /** Stable key of the series within the source. */
  key: string;
  name: string;
  kind: 'series' | 'cup' | 'league';
  season: string | null;
  round: number | null;
  roundLabel: string | null;
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
