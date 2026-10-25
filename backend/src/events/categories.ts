/**
 * Age categories of German Cycling (and the UCI). The age is the age a rider reaches in the
 * calendar year (cycling counts by year of birth). From 30 a licensed rider may choose a Masters
 * licence instead of Elite; the age bands of Masters are ten years.
 */
export interface RiderCategory {
  key: string;
  /** Inclusive ages; null means no limit. */
  ageMin: number | null;
  ageMax: number | null;
}

export const RIDER_CATEGORIES: readonly RiderCategory[] = [
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
];

export const CATEGORY_KEYS = RIDER_CATEGORIES.map((c) => c.key);

/** Category of a rider of this age (Elite from 23 to 29; Masters from 30). */
export function categoryForAge(age: number): RiderCategory {
  return (
    RIDER_CATEGORIES.find(
      (c) =>
        (c.ageMin == null || age >= c.ageMin) &&
        (c.ageMax == null || age <= c.ageMax),
    ) ?? RIDER_CATEGORIES[0]
  );
}

/** Reads "U15", "u 15", "Junioren", "Masters 2", "M2", "Elite" … into a category key. */
export function parseCategory(text: string): string | null {
  const t = text.toLowerCase().replace(/[\s_-]+/g, '');
  const u = /^u(7|9|11|13|15|17|19|23)$/.exec(t);
  if (u) return `u${u[1]}`;
  if (t === 'junioren' || t === 'juniorinnen' || t === 'juniors') return 'u19';
  if (t === 'elite') return 'elite';
  const m = /^(masters?|m)([1-4])$/.exec(t);
  if (m) return `masters${m[2]}`;
  return null;
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
