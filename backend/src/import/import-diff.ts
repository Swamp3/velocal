import type { Event } from '../events/entities/event.entity';
import { EventStatus } from '../events/entities/event.entity';
import type { RawEvent } from './interfaces/import-source.interface';

/** Fields an import may set on an event it owns. Everything else is never touched. */
export const IMPORT_FIELDS = [
  'name',
  'description',
  'startDate',
  'endDate',
  'startTimeKnown',
  'status',
  'locationName',
  'address',
  'country',
  'registrationDeadline',
  'externalUrl',
  'sourceUrl',
  'disciplineSlug',
  'sources',
  'importConflicts',
  'championship',
  'format',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** A rating class reduced to what an import compares. */
export interface ComparableClass {
  name: string;
  gender: string;
  ageMin: number | null;
  ageMax: number | null;
  category: string | null;
  license: string;
  dayLicense: boolean;
  licenseClasses: string[] | null;
  distanceKm: number | null;
  elevationM: number | null;
  startTime: string | null;
  championship: string | null;
  note: string | null;
}

export function comparableClasses(
  classes: {
    name: string;
    gender: string;
    ageMin: number | null;
    ageMax: number | null;
    category: string | null;
    license: string;
    dayLicense: boolean;
    licenseClasses: string[] | null;
    distanceKm: number | null;
    elevationM: number | null;
    startTime: Date | null;
    championship: string | null;
    note: string | null;
  }[],
): ComparableClass[] {
  return classes.map((c) => ({
    name: c.name,
    gender: c.gender,
    ageMin: c.ageMin ?? null,
    ageMax: c.ageMax ?? null,
    category: c.category ?? null,
    license: c.license,
    dayLicense: !!c.dayLicense,
    licenseClasses: c.licenseClasses?.length
      ? [...c.licenseClasses].sort()
      : null,
    distanceKm: c.distanceKm ?? null,
    elevationM: c.elevationM ?? null,
    startTime: c.startTime ? c.startTime.toISOString() : null,
    championship: c.championship ?? null,
    note: c.note ?? null,
  }));
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export function mapStatus(status: string): EventStatus {
  switch (status) {
    case 'cancelled':
      return EventStatus.CANCELLED;
    case 'completed':
      return EventStatus.COMPLETED;
    default:
      return EventStatus.PUBLISHED;
  }
}

/** The value the import would store for a field; `undefined` means "not given, keep". */
function incoming(raw: RawEvent, field: ImportField): unknown {
  switch (field) {
    case 'status':
      return mapStatus(raw.status);
    case 'startTimeKnown':
      return raw.startTimeKnown ?? true;
    case 'sources':
      return raw.sources;
    case 'importConflicts':
      return raw.conflicts;
    case 'sourceUrl':
      return raw.sourceUrl ?? raw.externalUrl;
    default:
      return (raw as unknown as Record<string, unknown>)[field];
  }
}

/** JSON with sorted keys: the database returns jsonb objects with keys reordered. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') return stableJson(value);
  return value ?? null;
}

function plain(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

/**
 * What an import would change on an event it owns. A field is only changed when the record
 * gives a value (missing means "keep", the import never clears a field) and when nobody edited
 * that field by hand (`protected`).
 */
export function diffImportedEvent(
  existing: Event,
  raw: RawEvent,
  currentClasses?: ComparableClass[],
): { changes: FieldChange[]; protected: FieldChange[] } {
  const changes: FieldChange[] = [];
  const kept: FieldChange[] = [];
  const edited = new Set(existing.editedFields ?? []);
  for (const field of IMPORT_FIELDS) {
    const next = incoming(raw, field);
    if (next === undefined) continue;
    const current = (existing as unknown as Record<string, unknown>)[field];
    if (comparable(current) === comparable(next)) continue;
    const change = { field, before: plain(current), after: plain(next) };
    if (edited.has(field)) kept.push(change);
    else changes.push(change);
  }
  if (raw.classes !== undefined && currentClasses) {
    const next = comparableClasses(raw.classes);
    if (stableJson(next) !== stableJson(currentClasses)) {
      const change = { field: 'classes', before: currentClasses, after: next };
      if (edited.has('classes')) kept.push(change);
      else changes.push(change);
    }
  }
  return { changes, protected: kept };
}

/** Applies changes from `diffImportedEvent` to the entity. */
export function applyChanges(
  existing: Event,
  raw: RawEvent,
  changes: FieldChange[],
): void {
  const target = existing as unknown as Record<string, unknown>;
  for (const { field } of changes) {
    // Classes and parking areas live in their own tables; the import service writes them.
    if (field === 'classes' || field === 'parkingAreas') continue;
    target[field] = incoming(raw, field as ImportField);
  }
}
