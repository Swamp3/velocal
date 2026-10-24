import { DISCIPLINE_SEEDS } from '../disciplines/disciplines.seed';
import type {
  EventConflict,
  EventSourceRef,
} from '../events/entities/event.entity';
import { berlinDay, parseEventDate } from './dates';
import type { RawEvent } from './interfaces/import-source.interface';

export const MAX_IMPORT_EVENTS = 5000;
export const IMPORT_STATUSES = ['published', 'cancelled', 'completed'];
const DISCIPLINES = new Set(DISCIPLINE_SEEDS.map((d) => d.slug));
const SOURCE_NAME = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const COUNTRY = /^[A-Z]{2}$/;
/** "TBD", "Ort folgt", "Austragungsort nicht angegeben", "wird noch bekanntgegeben" … */
const PLACEHOLDER =
  /\b(tbd|tba|n\/a)\b|\(?\s*(austragungs)?ort\s+(nicht angegeben|folgt|noch offen|unbekannt|wird noch bekannt\s*gegeben)\s*\)?|nicht angegeben|noch offen|wird noch bekannt\s*gegeben|unbekannt/gi;
/** A country or state alone is not a place to go to. */
const REGION_ONLY = new Set([
  'deutschland',
  'germany',
  'österreich',
  'schweiz',
  'baden-württemberg',
  'bayern',
  'berlin',
  'brandenburg',
  'bremen',
  'hamburg',
  'hessen',
  'mecklenburg-vorpommern',
  'niedersachsen',
  'nordrhein-westfalen',
  'nrw',
  'rheinland-pfalz',
  'saarland',
  'sachsen',
  'sachsen-anhalt',
  'schleswig-holstein',
  'thüringen',
]);

/**
 * `missing`: no real place (only a placeholder or a region). `vague`: a town, but the venue is
 * still open. `ok` otherwise.
 */
export function locationQuality(location: string): 'ok' | 'vague' | 'missing' {
  const rest = location.replace(PLACEHOLDER, ' ');
  if (rest === location) return 'ok';
  const cleaned = rest
    .replace(/[(),;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,–—-]+$/, '')
    .trim();
  if (cleaned.replace(/[^\p{L}]/gu, '').length < 2) return 'missing';
  if (REGION_ONLY.has(cleaned.toLowerCase())) return 'missing';
  return 'vague';
}

/**
 * `error` blocks the import. `warning` has to be confirmed by the admin before importing.
 * `info` only explains what will happen.
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ImportIssue {
  severity: IssueSeverity;
  code: string;
  /** Index of the event in the file; missing for problems of the whole file. */
  index?: number;
  externalId?: string;
  field?: string;
  params?: Record<string, string | number>;
}

export interface ValidatedFile {
  sourceName: string | null;
  complete: boolean;
  /** Same order as the file; `null` where the event has errors. */
  events: (RawEvent | null)[];
  /** Names of the events as given, for the report (also for invalid ones). */
  labels: {
    externalId: string | null;
    name: string | null;
    startDate: string | null;
  }[];
  issues: ImportIssue[];
}

const EVENT_FIELDS = new Set([
  'externalId',
  'name',
  'description',
  'startDate',
  'endDate',
  'startTimeKnown',
  'allDay',
  'disciplineSlug',
  'locationName',
  'address',
  'country',
  'lat',
  'lng',
  'registrationDeadline',
  'externalUrl',
  'sourceUrl',
  'status',
  'source',
  'conflicts',
]);
const FILE_FIELDS = new Set(['sourceName', 'complete', 'events']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname
    );
  } catch {
    return false;
  }
}

/**
 * Checks an import file without touching the database. Every rule that can be decided from the
 * file alone lives here, so the check endpoint, the import and the tests agree.
 */
export function validateImportFile(
  data: unknown,
  now: Date = new Date(),
): ValidatedFile {
  const issues: ImportIssue[] = [];
  const result: ValidatedFile = {
    sourceName: null,
    complete: false,
    events: [],
    labels: [],
    issues,
  };
  if (!isObject(data)) {
    issues.push({ severity: 'error', code: 'fileNotObject' });
    return result;
  }
  for (const key of Object.keys(data)) {
    if (!FILE_FIELDS.has(key))
      issues.push({ severity: 'warning', code: 'unknownField', field: key });
  }
  if (
    typeof data.sourceName !== 'string' ||
    !SOURCE_NAME.test(data.sourceName)
  ) {
    issues.push({
      severity: 'error',
      code: 'sourceNameInvalid',
      field: 'sourceName',
    });
  } else {
    result.sourceName = data.sourceName;
  }
  if (data.complete !== undefined && typeof data.complete !== 'boolean') {
    issues.push({
      severity: 'error',
      code: 'type',
      field: 'complete',
      params: { expected: 'boolean' },
    });
  }
  result.complete = data.complete === true;
  if (!Array.isArray(data.events) || data.events.length === 0) {
    issues.push({ severity: 'error', code: 'eventsMissing', field: 'events' });
    return result;
  }
  if (data.events.length > MAX_IMPORT_EVENTS) {
    issues.push({
      severity: 'error',
      code: 'tooManyEvents',
      params: { max: MAX_IMPORT_EVENTS },
    });
    return result;
  }

  const today = berlinDay(now);
  const farFuture = new Date(now.getTime() + 2 * 365 * 86_400_000);
  const firstIndexById = new Map<string, number>();
  const firstIndexByNameDay = new Map<string, number>();

  data.events.forEach((item, index) => {
    const own: ImportIssue[] = [];
    const add = (issue: Omit<ImportIssue, 'index' | 'externalId'>) =>
      own.push(issue);
    if (!isObject(item)) {
      result.labels.push({ externalId: null, name: null, startDate: null });
      result.events.push(null);
      issues.push({ severity: 'error', code: 'eventNotObject', index });
      return;
    }
    const str = (
      field: string,
      opts: { required?: boolean; min?: number; max: number },
    ) => {
      const value = item[field];
      if (value === undefined || value === null || value === '') {
        if (opts.required) add({ severity: 'error', code: 'required', field });
        return undefined;
      }
      if (typeof value !== 'string') {
        add({
          severity: 'error',
          code: 'type',
          field,
          params: { expected: 'string' },
        });
        return undefined;
      }
      const trimmed = value.trim();
      if (opts.min && trimmed.length < opts.min) {
        add({
          severity: 'error',
          code: 'tooShort',
          field,
          params: { min: opts.min },
        });
      }
      if (trimmed.length > opts.max) {
        add({
          severity: 'error',
          code: 'tooLong',
          field,
          params: { max: opts.max },
        });
      }
      return trimmed;
    };

    for (const key of Object.keys(item)) {
      if (!EVENT_FIELDS.has(key))
        add({ severity: 'warning', code: 'unknownField', field: key });
    }

    const externalId = str('externalId', { required: true, max: 200 });
    const name = str('name', { required: true, min: 2, max: 300 });
    const description = str('description', { max: 10000 });
    const locationName = str('locationName', { required: true, max: 255 });
    const address = str('address', { max: 255 });
    const disciplineSlug = str('disciplineSlug', { required: true, max: 40 });
    const status = str('status', { required: true, max: 20 });
    const country = str('country', { max: 2 });
    const externalUrl = str('externalUrl', { max: 500 });
    const sourceUrl = str('sourceUrl', { max: 500 });
    const startRaw = str('startDate', { required: true, max: 40 });
    const endRaw = str('endDate', { max: 40 });
    const deadlineRaw = str('registrationDeadline', { max: 40 });
    result.labels.push({
      externalId: externalId ?? null,
      name: name ?? null,
      startDate: startRaw ?? null,
    });

    if (externalId) {
      const first = firstIndexById.get(externalId);
      if (first !== undefined) {
        add({
          severity: 'error',
          code: 'duplicateExternalId',
          field: 'externalId',
          params: { other: first },
        });
      } else {
        firstIndexById.set(externalId, index);
      }
    }
    if (locationName) {
      const quality = locationQuality(locationName);
      if (quality === 'missing') {
        add({
          severity: 'error',
          code: 'locationPlaceholder',
          field: 'locationName',
          params: { value: locationName },
        });
      } else if (quality === 'vague') {
        add({
          severity: 'warning',
          code: 'locationVague',
          field: 'locationName',
          params: { value: locationName },
        });
      }
    }
    if (disciplineSlug && !DISCIPLINES.has(disciplineSlug)) {
      add({
        severity: 'error',
        code: 'disciplineUnknown',
        field: 'disciplineSlug',
        params: { value: disciplineSlug },
      });
    }
    if (status && !IMPORT_STATUSES.includes(status)) {
      add({
        severity: 'error',
        code: 'statusUnknown',
        field: 'status',
        params: { value: status },
      });
    }
    if (country && !COUNTRY.test(country)) {
      add({
        severity: 'error',
        code: 'countryInvalid',
        field: 'country',
        params: { value: country },
      });
    }
    for (const [field, value] of [
      ['externalUrl', externalUrl],
      ['sourceUrl', sourceUrl],
    ] as const) {
      if (value && !isUrl(value))
        add({ severity: 'error', code: 'urlInvalid', field });
    }

    // Dates
    const readDate = (field: string, raw: string | undefined) => {
      if (!raw) return null;
      const parsed = parseEventDate(raw);
      if (parsed.kind === 'invalid') {
        add({
          severity: 'error',
          code: 'dateInvalid',
          field,
          params: { value: raw },
        });
        return null;
      }
      if (parsed.kind === 'missingOffset') {
        add({
          severity: 'error',
          code: 'dateNeedsOffset',
          field,
          params: { value: raw },
        });
        return null;
      }
      return parsed;
    };
    const start = readDate('startDate', startRaw);
    const end = readDate('endDate', endRaw);
    const deadline = readDate('registrationDeadline', deadlineRaw);
    const timeKnownGiven = item.startTimeKnown;
    if (timeKnownGiven !== undefined && typeof timeKnownGiven !== 'boolean') {
      add({
        severity: 'error',
        code: 'type',
        field: 'startTimeKnown',
        params: { expected: 'boolean' },
      });
    }
    if (item.allDay !== undefined && typeof item.allDay !== 'boolean') {
      add({
        severity: 'error',
        code: 'type',
        field: 'allDay',
        params: { expected: 'boolean' },
      });
    }
    let startTimeKnown = start?.kind === 'dateTime';
    if (
      start &&
      typeof timeKnownGiven === 'boolean' &&
      timeKnownGiven !== startTimeKnown
    ) {
      if (timeKnownGiven) {
        add({
          severity: 'error',
          code: 'startTimeKnownMismatch',
          field: 'startTimeKnown',
        });
      } else {
        // A time is given but marked as unknown: show the day only.
        add({
          severity: 'warning',
          code: 'timeIgnored',
          field: 'startTimeKnown',
        });
        startTimeKnown = false;
      }
    }
    if (start && end && end.date.getTime() < start.date.getTime()) {
      add({ severity: 'error', code: 'endBeforeStart', field: 'endDate' });
    }
    if (start) {
      const day = berlinDay(start.date);
      if (day < today)
        add({
          severity: 'warning',
          code: 'pastEvent',
          field: 'startDate',
          params: { value: day },
        });
      if (start.date > farFuture)
        add({
          severity: 'warning',
          code: 'farFuture',
          field: 'startDate',
          params: { value: day },
        });
      if (
        deadline &&
        deadline.date.getTime() > (end ?? start).date.getTime() + 86_400_000
      ) {
        add({
          severity: 'warning',
          code: 'deadlineAfterStart',
          field: 'registrationDeadline',
        });
      }
      if (name) {
        const key = `${name.toLowerCase()}|${day}`;
        const first = firstIndexByNameDay.get(key);
        if (first !== undefined) {
          add({
            severity: 'warning',
            code: 'sameNameSameDay',
            field: 'name',
            params: { other: first },
          });
        } else {
          firstIndexByNameDay.set(key, index);
        }
      }
    }

    // Coordinates
    const lat = item.lat;
    const lng = item.lng;
    const hasLat = lat !== undefined && lat !== null;
    const hasLng = lng !== undefined && lng !== null;
    if (hasLat !== hasLng)
      add({
        severity: 'error',
        code: 'coordinatesIncomplete',
        field: hasLat ? 'lng' : 'lat',
      });
    if (hasLat && (typeof lat !== 'number' || lat < -90 || lat > 90)) {
      add({ severity: 'error', code: 'coordinateInvalid', field: 'lat' });
    }
    if (hasLng && (typeof lng !== 'number' || lng < -180 || lng > 180)) {
      add({ severity: 'error', code: 'coordinateInvalid', field: 'lng' });
    }
    if (!hasLat && !hasLng) add({ severity: 'info', code: 'noCoordinates' });

    // Sources
    const sources: EventSourceRef[] = [];
    if (item.source !== undefined) {
      if (!Array.isArray(item.source)) {
        add({
          severity: 'error',
          code: 'type',
          field: 'source',
          params: { expected: 'array' },
        });
      } else {
        item.source.forEach((entry, i) => {
          const field = `source[${i}]`;
          if (
            !isObject(entry) ||
            typeof entry.name !== 'string' ||
            !entry.name.trim()
          ) {
            add({
              severity: 'error',
              code: 'sourceInvalid',
              field: `${field}.name`,
            });
            return;
          }
          if (typeof entry.url !== 'string' || !isUrl(entry.url)) {
            add({
              severity: 'error',
              code: 'urlInvalid',
              field: `${field}.url`,
            });
            return;
          }
          const ref: EventSourceRef = {
            name: entry.name.trim().slice(0, 200),
            url: entry.url.slice(0, 500),
          };
          for (const key of ['checkedAt', 'updatedAt'] as const) {
            const value = entry[key];
            if (value === undefined) continue;
            if (
              typeof value !== 'string' ||
              parseEventDate(value).kind === 'invalid'
            ) {
              add({
                severity: 'error',
                code: 'dateInvalid',
                field: `${field}.${key}`,
                params: { value: JSON.stringify(value) },
              });
            } else {
              ref[key] = value;
            }
          }
          sources.push(ref);
        });
      }
    }

    // Conflicts
    const conflicts: EventConflict[] = [];
    if (item.conflicts !== undefined) {
      if (!Array.isArray(item.conflicts)) {
        add({
          severity: 'error',
          code: 'type',
          field: 'conflicts',
          params: { expected: 'array' },
        });
      } else {
        item.conflicts.forEach((entry, i) => {
          if (typeof entry === 'string' && entry.trim()) {
            conflicts.push({ field: 'note', reason: entry.trim() });
          } else if (isObject(entry) && typeof entry.field === 'string') {
            conflicts.push(entry as unknown as EventConflict);
          } else {
            add({
              severity: 'error',
              code: 'conflictInvalid',
              field: `conflicts[${i}]`,
            });
          }
        });
        if (conflicts.length > 0) {
          add({
            severity: 'warning',
            code: 'hasConflicts',
            field: 'conflicts',
            params: { count: conflicts.length },
          });
        }
      }
    }

    for (const issue of own)
      issues.push({ ...issue, index, externalId: externalId ?? undefined });
    if (
      own.some((issue) => issue.severity === 'error') ||
      !start ||
      !externalId ||
      !name
    ) {
      result.events.push(null);
      return;
    }
    result.events.push({
      externalId,
      sourceName: result.sourceName ?? '',
      name,
      description,
      startDate: start.date,
      endDate: end?.date,
      startTimeKnown,
      disciplineSlug: disciplineSlug as string,
      locationName: locationName as string,
      address,
      country,
      lat: hasLat ? (lat as number) : undefined,
      lng: hasLng ? (lng as number) : undefined,
      registrationDeadline: deadline?.date,
      externalUrl,
      sourceUrl,
      status: status as string,
      sources: sources.length ? sources : undefined,
      conflicts: conflicts.length ? conflicts : undefined,
    });
  });
  return result;
}

const MESSAGES: Record<string, (issue: ImportIssue) => string> = {
  fileNotObject: () =>
    'The file must be a JSON object with sourceName and events',
  sourceNameInvalid: () =>
    'sourceName must be 3-40 characters: lower-case letters, digits and hyphens',
  eventsMissing: () => 'events must be a non-empty list',
  tooManyEvents: (i) => `At most ${i.params?.max} events per file`,
  eventNotObject: () => 'The event must be a JSON object',
  unknownField: (i) => `Unknown field "${i.field}" is ignored`,
  required: (i) => `${i.field} is required`,
  type: (i) => `${i.field} must be of type ${i.params?.expected}`,
  tooShort: (i) => `${i.field} must have at least ${i.params?.min} characters`,
  tooLong: (i) => `${i.field} must have at most ${i.params?.max} characters`,
  duplicateExternalId: (i) =>
    `externalId is already used by event #${i.params?.other}`,
  locationPlaceholder: (i) =>
    `locationName "${i.params?.value}" is not a real place`,
  locationVague: (i) =>
    `locationName "${i.params?.value}" names the town but not the venue`,
  disciplineUnknown: (i) => `Unknown discipline "${i.params?.value}"`,
  statusUnknown: (i) =>
    `Unknown status "${i.params?.value}" (published, cancelled, completed)`,
  countryInvalid: (i) =>
    `country "${i.params?.value}" must be a two-letter code such as DE`,
  urlInvalid: (i) => `${i.field} must be a full http(s) URL`,
  dateInvalid: (i) =>
    `${i.field} "${i.params?.value}" is not a valid date (YYYY-MM-DD or ISO 8601 with offset)`,
  dateNeedsOffset: (i) =>
    `${i.field} "${i.params?.value}" needs a time zone offset such as +01:00`,
  startTimeKnownMismatch: () =>
    'startTimeKnown is true but startDate has no time',
  timeIgnored: () =>
    'startDate has a time but startTimeKnown is false: only the day is shown',
  endBeforeStart: () => 'endDate is before startDate',
  pastEvent: (i) => `The event is in the past (${i.params?.value})`,
  farFuture: (i) =>
    `The event is more than two years ahead (${i.params?.value})`,
  deadlineAfterStart: () => 'registrationDeadline is after the event',
  sameNameSameDay: (i) =>
    `Same name on the same day as event #${i.params?.other}`,
  coordinatesIncomplete: () => 'Give both lat and lng, or neither',
  coordinateInvalid: (i) => `${i.field} is not a valid coordinate`,
  noCoordinates: () =>
    'No coordinates: the place is looked up from the location',
  sourceInvalid: (i) => `${i.field} is missing`,
  conflictInvalid: (i) => `${i.field} must be a text or an object with "field"`,
  hasConflicts: (i) =>
    `${i.params?.count} documented conflict(s) between sources`,
  possibleDuplicate: (i) =>
    `Possibly the same as existing event "${i.params?.name}" (${i.params?.source}): not imported`,
  protectedFields: (i) => `Edited by hand, kept: ${i.params?.fields}`,
  otherSource: (i) =>
    `The event belongs to another source (${i.params?.source}) or was created by hand: not changed`,
  markedMissing: (i) =>
    `${i.params?.count} upcoming event(s) of this source are not in the file and will be marked as no longer listed`,
  geocodeFailed: () =>
    'The place could not be found: the event is not shown on the map',
  saveFailed: (i) => `Could not be saved: ${i.params?.message}`,
};

/** English text of an issue, for the API and the command line (the admin page translates codes). */
export function issueMessage(issue: ImportIssue): string {
  return MESSAGES[issue.code]?.(issue) ?? issue.code;
}
