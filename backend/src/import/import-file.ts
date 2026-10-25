import { DISCIPLINE_SEEDS } from '../disciplines/disciplines.seed';
import type {
  EventConflict,
  EventSourceRef,
} from '../events/entities/event.entity';
import { berlinDay, parseEventDate } from './dates';
import { CATEGORY_KEYS, classAges } from '../events/categories';
import { EVENT_FORMATS, type EventFormat } from '../events/formats';
import type {
  RawEvent,
  RawEventClass,
  RawEventSeries,
} from './interfaces/import-source.interface';

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
  'classes',
  'championship',
  'format',
  'series',
]);
export const CHAMPIONSHIP_LEVELS = [
  'club',
  'district',
  'state',
  'regional',
  'national',
  'continental',
  'world',
];
const CLASS_FIELDS = new Set([
  'name',
  'gender',
  'ageMin',
  'ageMax',
  'category',
  'license',
  'dayLicense',
  'licenseClasses',
  'distanceKm',
  'elevationM',
  'startTime',
  'championship',
  'note',
]);
const CLASS_LICENSES = ['open', 'unlicensed', 'license', 'uci'];
const LICENSE_CLASSES = ['elite_amateur', 'amateur', 'master'];
const SERIES_FIELDS = new Set([
  'key',
  'name',
  'kind',
  'season',
  'round',
  'roundLabel',
]);
const FILE_FIELDS = new Set(['sourceName', 'complete', 'events']);

/** A value for a message: strings as they are, anything else as JSON. */
function show(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

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

    // Championship
    let championship: string | undefined;
    if (item.championship !== undefined && item.championship !== null) {
      if (
        typeof item.championship !== 'string' ||
        !CHAMPIONSHIP_LEVELS.includes(item.championship)
      ) {
        add({
          severity: 'error',
          code: 'championshipUnknown',
          field: 'championship',
          params: { value: show(item.championship) },
        });
      } else {
        championship = item.championship;
      }
    }

    // Format
    let format: EventFormat | undefined;
    if (item.format !== undefined && item.format !== null) {
      if (
        typeof item.format !== 'string' ||
        !(EVENT_FORMATS as readonly string[]).includes(item.format)
      ) {
        add({
          severity: 'error',
          code: 'formatUnknown',
          field: 'format',
          params: { value: show(item.format) },
        });
      } else {
        format = item.format as EventFormat;
      }
    }

    // Rating classes
    let classes: RawEventClass[] | undefined;
    if (item.classes !== undefined) {
      if (!Array.isArray(item.classes)) {
        add({
          severity: 'error',
          code: 'type',
          field: 'classes',
          params: { expected: 'array' },
        });
      } else {
        const list: RawEventClass[] = [];
        item.classes.forEach((entry: unknown, i: number) => {
          const field = `classes[${i}]`;
          if (!isObject(entry)) {
            add({ severity: 'error', code: 'classInvalid', field });
            return;
          }
          for (const key of Object.keys(entry)) {
            if (!CLASS_FIELDS.has(key)) {
              add({
                severity: 'warning',
                code: 'unknownField',
                field: `${field}.${key}`,
              });
            }
          }
          const name = typeof entry.name === 'string' ? entry.name.trim() : '';
          if (!name)
            add({
              severity: 'error',
              code: 'required',
              field: `${field}.name`,
            });
          if (name.length > 120) {
            add({
              severity: 'error',
              code: 'tooLong',
              field: `${field}.name`,
              params: { max: 120 },
            });
          }
          const gender = entry.gender ?? 'open';
          if (
            typeof gender !== 'string' ||
            !['open', 'male', 'female'].includes(gender)
          ) {
            add({
              severity: 'error',
              code: 'classGenderUnknown',
              field: `${field}.gender`,
              params: { value: show(gender) },
            });
          }
          const license = entry.license ?? 'open';
          if (
            typeof license !== 'string' ||
            !CLASS_LICENSES.includes(license)
          ) {
            add({
              severity: 'error',
              code: 'classLicenseUnknown',
              field: `${field}.license`,
              params: { value: show(license) },
            });
          }
          if (
            entry.dayLicense !== undefined &&
            typeof entry.dayLicense !== 'boolean'
          ) {
            add({
              severity: 'error',
              code: 'type',
              field: `${field}.dayLicense`,
              params: { expected: 'boolean' },
            });
          }
          let licenseClasses: RawEventClass['licenseClasses'] = null;
          if (
            entry.licenseClasses !== undefined &&
            entry.licenseClasses !== null
          ) {
            const values = entry.licenseClasses;
            if (
              !Array.isArray(values) ||
              values.some(
                (v) => typeof v !== 'string' || !LICENSE_CLASSES.includes(v),
              )
            ) {
              add({
                severity: 'error',
                code: 'classLicenseClassUnknown',
                field: `${field}.licenseClasses`,
                params: { value: show(values) },
              });
            } else if (values.length) {
              licenseClasses = [
                ...new Set(values),
              ] as RawEventClass['licenseClasses'];
            }
          }
          let category: string | null = null;
          if (entry.category !== undefined && entry.category !== null) {
            if (
              typeof entry.category !== 'string' ||
              !CATEGORY_KEYS.includes(entry.category)
            ) {
              add({
                severity: 'error',
                code: 'classCategoryUnknown',
                field: `${field}.category`,
                params: { value: show(entry.category) },
              });
            } else {
              category = entry.category;
            }
          }
          const age = (key: 'ageMin' | 'ageMax'): number | null => {
            const value = entry[key];
            if (value === undefined || value === null) return null;
            if (
              typeof value !== 'number' ||
              !Number.isInteger(value) ||
              value < 0 ||
              value > 120
            ) {
              add({
                severity: 'error',
                code: 'ageInvalid',
                field: `${field}.${key}`,
              });
              return null;
            }
            return value;
          };
          const measure = (
            key: 'distanceKm' | 'elevationM',
            max: number,
          ): number | null => {
            const value = entry[key];
            if (value === undefined || value === null) return null;
            if (
              typeof value !== 'number' ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > max
            ) {
              add({
                severity: 'error',
                code: 'numberInvalid',
                field: `${field}.${key}`,
                params: { max },
              });
              return null;
            }
            return key === 'elevationM'
              ? Math.round(value)
              : Math.round(value * 10) / 10;
          };
          const distanceKm = measure('distanceKm', 9999);
          const elevationM = measure('elevationM', 99999);
          const { ageMin, ageMax } = classAges(
            category,
            age('ageMin'),
            age('ageMax'),
          );
          if (ageMin != null && ageMax != null && ageMin > ageMax) {
            add({
              severity: 'error',
              code: 'ageRange',
              field: `${field}.ageMax`,
            });
          }
          let startTime: Date | null = null;
          if (entry.startTime !== undefined && entry.startTime !== null) {
            const parsed =
              typeof entry.startTime === 'string'
                ? parseEventDate(entry.startTime)
                : ({ kind: 'invalid' } as const);
            if (parsed.kind === 'dateTime') {
              startTime = parsed.date;
            } else {
              add({
                severity: 'error',
                code:
                  parsed.kind === 'missingOffset'
                    ? 'dateNeedsOffset'
                    : 'dateInvalid',
                field: `${field}.startTime`,
                params: { value: show(entry.startTime) },
              });
            }
          }
          const level = entry.championship ?? null;
          if (
            level !== null &&
            (typeof level !== 'string' || !CHAMPIONSHIP_LEVELS.includes(level))
          ) {
            add({
              severity: 'error',
              code: 'championshipUnknown',
              field: `${field}.championship`,
              params: { value: show(level) },
            });
          }
          const note =
            typeof entry.note === 'string'
              ? entry.note.trim().slice(0, 300) || null
              : null;
          list.push({
            name,
            gender: gender as RawEventClass['gender'],
            ageMin,
            ageMax,
            category,
            license: (CLASS_LICENSES.includes(license as string)
              ? license
              : 'open') as RawEventClass['license'],
            dayLicense: entry.dayLicense === true,
            licenseClasses,
            distanceKm,
            elevationM,
            startTime,
            championship: typeof level === 'string' ? level : null,
            note,
          });
        });
        classes = list;
      }
    }

    // Series (one object or a list)
    let series: RawEventSeries[] | undefined;
    if (item.series !== undefined && item.series !== null) {
      const many = Array.isArray(item.series);
      const list: unknown[] = many ? (item.series as unknown[]) : [item.series];
      const parsedSeries: RawEventSeries[] = [];
      list.forEach((entry, i) => {
        const field = many ? `series[${i}]` : 'series';
        if (!isObject(entry)) {
          add({ severity: 'error', code: 'seriesInvalid', field });
          return;
        }
        for (const key of Object.keys(entry)) {
          if (!SERIES_FIELDS.has(key)) {
            add({
              severity: 'warning',
              code: 'unknownField',
              field: `${field}.${key}`,
            });
          }
        }
        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!key)
          add({ severity: 'error', code: 'required', field: `${field}.key` });
        if (key.length > 200)
          add({
            severity: 'error',
            code: 'tooLong',
            field: `${field}.key`,
            params: { max: 200 },
          });
        if (!name)
          add({ severity: 'error', code: 'required', field: `${field}.name` });
        if (name.length > 200)
          add({
            severity: 'error',
            code: 'tooLong',
            field: `${field}.name`,
            params: { max: 200 },
          });
        const kind = entry.kind ?? 'series';
        if (
          typeof kind !== 'string' ||
          !['series', 'cup', 'league'].includes(kind)
        ) {
          add({
            severity: 'error',
            code: 'seriesKindUnknown',
            field: `${field}.kind`,
            params: { value: show(kind) },
          });
        }
        const season =
          typeof entry.season === 'string'
            ? entry.season.trim().slice(0, 20) || null
            : null;
        const round = entry.round;
        if (
          round !== undefined &&
          round !== null &&
          (typeof round !== 'number' || !Number.isInteger(round) || round < 1)
        ) {
          add({
            severity: 'error',
            code: 'roundInvalid',
            field: `${field}.round`,
          });
        }
        const roundLabel =
          typeof entry.roundLabel === 'string'
            ? entry.roundLabel.trim().slice(0, 100) || null
            : null;
        parsedSeries.push({
          key,
          name,
          kind: kind as RawEventSeries['kind'],
          season,
          round: typeof round === 'number' ? round : null,
          roundLabel,
        });
      });
      series = parsedSeries;
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
      classes,
      championship,
      format,
      series,
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
  championshipUnknown: (i) => `Unknown championship level ${i.params?.value}`,
  classInvalid: (i) => `${i.field} must be an object`,
  classGenderUnknown: (i) =>
    `Unknown gender ${i.params?.value} (open, male, female)`,
  classLicenseUnknown: (i) =>
    `Unknown licence ${i.params?.value} (open, unlicensed, license, uci)`,
  classLicenseClassUnknown: (i) =>
    `Unknown licence classes ${i.params?.value} (elite_amateur, amateur, master)`,
  formatUnknown: (i) =>
    `Unknown format ${i.params?.value} (${EVENT_FORMATS.join(', ')})`,
  numberInvalid: (i) => `Must be a number from 0 to ${i.params?.max}`,
  classCategoryUnknown: (i) =>
    `Unknown category ${i.params?.value} (${CATEGORY_KEYS.join(', ')})`,
  ageInvalid: (i) => `${i.field} must be a whole number of years`,
  ageRange: () => 'ageMax is lower than ageMin',
  seriesInvalid: (i) => `${i.field} must be an object`,
  seriesKindUnknown: (i) =>
    `Unknown series kind ${i.params?.value} (series, cup, league)`,
  roundInvalid: (i) => `${i.field} must be a whole number from 1`,
  seriesSummary: (i) =>
    `${i.params?.total} series in the file, ${i.params?.created} of them new`,
};

/** English text of an issue, for the API and the command line (the admin page translates codes). */
export function issueMessage(issue: ImportIssue): string {
  return MESSAGES[issue.code]?.(issue) ?? issue.code;
}
