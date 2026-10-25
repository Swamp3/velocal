/**
 * The racing model: every list of values and every rule about classes, licences, age categories,
 * championships and event formats lives here and nowhere else. Entities, DTOs and the import use
 * these lists; the browser loads them from `GET /api/events/racing-meta` (see `racingMeta()`).
 * Migrations keep their own copies, because a migration must not change once released.
 */

// ── Who may start ────────────────────────────────────────────────────────────

/** Gender of a class; `open` admits everyone. */
export const CLASS_GENDERS = ['open', 'male', 'female'] as const;
export type ClassGender = (typeof CLASS_GENDERS)[number];

/** Gender a rider states; `diverse` may start in any class. */
export const RIDER_GENDERS = ['male', 'female', 'diverse'] as const;
export type RiderGender = (typeof RIDER_GENDERS)[number];

/**
 * Who may start in a class, by licence:
 * - `open`: everyone (Jedermann; licence holders usually too)
 * - `unlicensed`: only riders without a licence (Hobby class)
 * - `license`: a federation race licence (German Cycling); with `dayLicense` a rider without one
 *   may buy a day licence (up to five a year)
 * - `uci`: a licence of a UCI-registered team
 */
export const CLASS_LICENSES = ['open', 'unlicensed', 'license', 'uci'] as const;
export type ClassLicense = (typeof CLASS_LICENSES)[number];

/** Licence a rider holds: none (Hobby, Jedermann), a federation licence, a UCI team licence. */
export const RIDER_LICENSES = ['none', 'license', 'uci'] as const;
export type RiderLicense = (typeof RIDER_LICENSES)[number];

/**
 * Licence classes of licensed adults (German Cycling since 2019), with the age from which a
 * rider can hold them. Youth licences (U11 to U19) have no licence class.
 */
export const LICENSE_CLASSES = [
  { key: 'elite_amateur', minAge: 19 },
  { key: 'amateur', minAge: 19 },
  { key: 'master', minAge: 30 },
] as const;
export type LicenseClass = (typeof LICENSE_CLASSES)[number]['key'];
export const LICENSE_CLASS_KEYS: LicenseClass[] = LICENSE_CLASSES.map(
  (c) => c.key,
);

/** Licence classes a licensed rider of this age can hold (all when the age is unknown). */
export function licenseClassesForAge(age: number | null): LicenseClass[] {
  return LICENSE_CLASSES.filter((c) => age == null || age >= c.minAge).map(
    (c) => c.key,
  );
}

// ── Age categories ───────────────────────────────────────────────────────────

/**
 * Age categories of German Cycling and the UCI. The age is the one a rider reaches in the
 * calendar year (cycling counts by year of birth). U7 and U9 are kids' races; from 30 a licensed
 * rider may choose Masters instead of Elite. Limits are inclusive; null means no limit.
 */
export const RIDER_CATEGORIES = [
  { key: 'u7', ageMin: null, ageMax: 6 },
  { key: 'u9', ageMin: 7, ageMax: 8 },
  { key: 'u11', ageMin: 9, ageMax: 10 },
  { key: 'u13', ageMin: 11, ageMax: 12 },
  { key: 'u15', ageMin: 13, ageMax: 14 },
  { key: 'u17', ageMin: 15, ageMax: 16 },
  { key: 'u19', ageMin: 17, ageMax: 18 },
  { key: 'u23', ageMin: 19, ageMax: 22 },
  { key: 'elite', ageMin: 23, ageMax: 29 },
  { key: 'masters1', ageMin: 30, ageMax: 39 },
  { key: 'masters2', ageMin: 40, ageMax: 49 },
  { key: 'masters3', ageMin: 50, ageMax: 59 },
  { key: 'masters4', ageMin: 60, ageMax: null },
] as const satisfies readonly {
  key: string;
  ageMin: number | null;
  ageMax: number | null;
}[];
export type RiderCategory = (typeof RIDER_CATEGORIES)[number];
export const CATEGORY_KEYS: string[] = RIDER_CATEGORIES.map((c) => c.key);

/** Category of a rider of this age. */
export function categoryForAge(age: number): RiderCategory {
  return (
    RIDER_CATEGORIES.find(
      (c) =>
        (c.ageMin == null || age >= c.ageMin) &&
        (c.ageMax == null || age <= c.ageMax),
    ) ?? RIDER_CATEGORIES[0]
  );
}

/** The ages of a class: given ages win, missing ones come from its category. */
export function classAges(
  category: string | null | undefined,
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
): { ageMin: number | null; ageMax: number | null } {
  const preset = category
    ? RIDER_CATEGORIES.find((c) => c.key === category)
    : undefined;
  return {
    ageMin: ageMin ?? preset?.ageMin ?? null,
    ageMax: ageMax ?? preset?.ageMax ?? null,
  };
}

// ── Championships and series ─────────────────────────────────────────────────

/** Level of a championship, from local to world. */
export const CHAMPIONSHIP_LEVELS = [
  'club',
  'district',
  'state',
  'regional',
  'national',
  'continental',
  'world',
] as const;
export type ChampionshipLevel = (typeof CHAMPIONSHIP_LEVELS)[number];

/**
 * `series`: a loose series. `cup`: races counting for one ranking (Läufe). `league`: a league with
 * matchdays in one season (Spieltage).
 */
export const SERIES_KINDS = ['series', 'cup', 'league'] as const;
export type SeriesKind = (typeof SERIES_KINDS)[number];

// ── Event formats ────────────────────────────────────────────────────────────

/**
 * What kind of event it is. Races, Jedermann and kids' races are timed; touring formats
 * (Breitensport) have no times or placings. `discipline` is the bike type a touring format gets
 * when the source only says "Breitensport".
 */
export const EVENT_FORMATS = [
  { key: 'race', touring: false, discipline: null }, // licence race (Hobby classes included)
  { key: 'jedermann', touring: false, discipline: null }, // open race, Gran Fondo
  { key: 'kids', touring: false, discipline: null }, // Fette-Reifen-Rennen, Laufradrennen
  { key: 'rtf', touring: true, discipline: 'strasse' }, // Radtourenfahrt, road, 20–199 km
  { key: 'ctf', touring: true, discipline: 'mtb' }, // Country-Tourenfahrt, off-road
  { key: 'marathon', touring: true, discipline: 'strasse' }, // Radmarathon, 200 km and more
  { key: 'brevet', touring: true, discipline: 'strasse' }, // randonneurs, 200–600 km
  { key: 'gravel_ride', touring: true, discipline: 'gravel' }, // gravel tour
  { key: 'tour', touring: true, discipline: null }, // Radwandern, Volksradfahren, club tours
] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number]['key'];
export const EVENT_FORMAT_KEYS: EventFormat[] = EVENT_FORMATS.map((f) => f.key);
export const TOURING_FORMATS: EventFormat[] = EVENT_FORMATS.filter(
  (f) => f.touring,
).map((f) => f.key);

/** Discipline of recreational events whose bike type is unknown; also the touring filter. */
export const TOURING_DISCIPLINE = 'breitensport';

/** Oldest age (reached in the year) of a kids' race; also finds kids' classes of other events. */
export const KIDS_MAX_AGE = 12;

/** Name patterns, checked in order; the first match wins. Kids' races come last. */
const FORMAT_RULES: [RegExp, EventFormat][] = [
  [/\bRTF\b|Radtourenfahrt/i, 'rtf'],
  [/\bCTF\b|Country[-\s]?Tour/i, 'ctf'],
  [/Radmarathon/i, 'marathon'],
  [/\bBrevet|\bAudax\b|Randonn|^ARA\b/i, 'brevet'],
  [/Jedermann|Jederfrau|Gran\s?Fondo/i, 'jedermann'],
  [/Gravel[-\s]?(Ride|Tour|Fahrt)/i, 'gravel_ride'],
  [/Radwander|Volksradfahr/i, 'tour'],
  [
    /Fette[-\s]?Reifen|Laufrad[-\s]?Rennen|Kinder[-\s]?Rennen|Kids[-\s]?(Race|Rennen|Cup)|Bambini/i,
    'kids',
  ],
];

/** The format an event name clearly states, or null (a plain race name says nothing). */
export function inferFormat(name: string): EventFormat | null {
  for (const [pattern, format] of FORMAT_RULES)
    if (pattern.test(name)) return format;
  return null;
}

/** The bike type for a "Breitensport" event of a known format; other disciplines stay. */
export function disciplineFor(
  discipline: string,
  format: EventFormat | null | undefined,
): string {
  if (discipline !== TOURING_DISCIPLINE || !format) return discipline;
  return EVENT_FORMATS.find((f) => f.key === format)?.discipline ?? discipline;
}

// ── Fits me ──────────────────────────────────────────────────────────────────

/** What a rider told us about themselves for finding fitting race classes. */
export interface RiderProfile {
  birthYear: number | null;
  gender: RiderGender | null;
  licenseType: RiderLicense | null;
  licenseClass: LicenseClass | null;
}

/** The rider stated anything the class rule can use. */
export function hasRiderData(rider: RiderProfile): boolean {
  return (
    rider.birthYear != null || rider.gender != null || rider.licenseType != null
  );
}

/**
 * Whether a class (alias `fc`) of an event (alias `event`) fits the rider, as SQL. Ages count by
 * year of birth; unknown profile data excludes nothing; "diverse" may start in any gender class.
 * Hobby classes are only for riders without licence; `license` classes need a licence unless they
 * allow a day licence; `uci` classes need a UCI licence; `license_classes` admits licensed riders
 * of those classes only. Named parameters start with `fit`.
 */
export function classFitCondition(rider: RiderProfile): {
  sql: string;
  params: Record<string, unknown>;
} {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (rider.birthYear != null) {
    params.fitBirthYear = rider.birthYear;
    const age = `(EXTRACT(YEAR FROM (event.startDate AT TIME ZONE 'Europe/Berlin'))::int - :fitBirthYear)`;
    conditions.push(
      `(fc.age_min IS NULL OR ${age} >= fc.age_min)`,
      `(fc.age_max IS NULL OR ${age} <= fc.age_max)`,
    );
  }
  if (rider.gender === 'male' || rider.gender === 'female') {
    params.fitGender = rider.gender;
    conditions.push(`(fc.gender = 'open' OR fc.gender::text = :fitGender)`);
  }
  if (rider.licenseType === 'none') {
    conditions.push(
      `(fc.license IN ('open', 'unlicensed') OR (fc.license = 'license' AND fc.day_license))`,
    );
  } else if (rider.licenseType === 'license') {
    conditions.push(`fc.license IN ('open', 'license')`);
  } else if (rider.licenseType === 'uci') {
    conditions.push(`fc.license IN ('open', 'license', 'uci')`);
  }
  const licensed =
    rider.licenseType === 'license' || rider.licenseType === 'uci';
  if (licensed && rider.licenseClass != null) {
    params.fitLicenseClass = rider.licenseClass;
    conditions.push(
      `(fc.license_classes IS NULL OR cardinality(fc.license_classes) = 0 OR :fitLicenseClass = ANY(fc.license_classes))`,
    );
  }
  return { sql: conditions.length ? conditions.join(' AND ') : 'TRUE', params };
}

/**
 * Whether an event (alias `event`) fits the rider: one of its classes fits, or it has no classes
 * and is a touring event (open to everyone) or a kids' race and the rider is a child without a
 * licence.
 */
export function eventFitsSql(rider: RiderProfile): {
  sql: string;
  params: Record<string, unknown>;
} {
  const cls = classFitCondition(rider);
  const licensed =
    rider.licenseType === 'license' || rider.licenseType === 'uci';
  const kids = licensed
    ? 'FALSE'
    : rider.birthYear == null
      ? 'TRUE'
      : `EXTRACT(YEAR FROM (event.startDate AT TIME ZONE 'Europe/Berlin'))::int - :fitBirthYear <= :fitKidsAge`;
  return {
    sql:
      `(EXISTS (SELECT 1 FROM "event_classes" fc WHERE fc.event_id = event.id AND ${cls.sql})` +
      ` OR (NOT EXISTS (SELECT 1 FROM "event_classes" tc WHERE tc.event_id = event.id)` +
      ` AND (event.format IN (:...fitTouring) OR (event.format = 'kids' AND ${kids}))))`,
    params: {
      ...cls.params,
      fitBirthYear: rider.birthYear,
      fitTouring: TOURING_FORMATS,
      fitKidsAge: KIDS_MAX_AGE,
    },
  };
}

// ── For the browser ──────────────────────────────────────────────────────────

/** All lists the browser needs, served by `GET /api/events/racing-meta`. */
export function racingMeta() {
  return {
    classGenders: CLASS_GENDERS,
    riderGenders: RIDER_GENDERS,
    classLicenses: CLASS_LICENSES,
    riderLicenses: RIDER_LICENSES,
    licenseClasses: LICENSE_CLASSES,
    categories: RIDER_CATEGORIES,
    championshipLevels: CHAMPIONSHIP_LEVELS,
    seriesKinds: SERIES_KINDS,
    formats: EVENT_FORMATS,
    touringDiscipline: TOURING_DISCIPLINE,
    kidsMaxAge: KIDS_MAX_AGE,
  };
}
export type RacingMeta = ReturnType<typeof racingMeta>;
