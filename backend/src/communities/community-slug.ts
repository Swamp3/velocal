/** Slugs that collide with community routes or `GET /api/communities/mine`. */
export const RESERVED_COMMUNITY_SLUGS = new Set(['mine', 'new']);

/** Slugs that collide with the create-subgroup route. */
export const RESERVED_SUBGROUP_SLUGS = new Set(['new']);

/**
 * German transliteration, then accents dropped ("Rokkā" → "rokka"), then a non-empty fallback
 * when the name has no slug characters.
 */
export function slugBase(name: string, fallback: string): string {
  const base = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || fallback;
}

/** First candidate that is neither reserved nor already taken. */
export function pickSlug(
  base: string,
  reserved: ReadonlySet<string>,
  taken: ReadonlySet<string>,
): string {
  if (!reserved.has(base) && !taken.has(base)) return base;
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (reserved.has(candidate) || taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/** What a slug may look like: lower-case letters and digits, joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const MAX_SLUG_LENGTH = 100;

export function isValidSlug(slug: string): boolean {
  return slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

export interface SlugItem {
  id: string;
  /** Slugs are unique per scope: all communities, or the subgroups of one community. */
  scope: string;
  slug: string;
}

export type SlugProblem = 'invalid' | 'reserved' | 'taken';

export interface SlugChange extends SlugItem {
  newSlug: string;
  problem: SlugProblem | null;
}

/**
 * Replaces every occurrence of `find` in the slug of each item and checks the result.
 * `taken` lists all existing slugs per scope; renamed items free their old slug, and two
 * items in one scope that end up with the same slug count as a clash.
 */
export function planSlugReplace(
  items: readonly SlugItem[],
  find: string,
  replace: string,
  reserved: ReadonlySet<string>,
  taken: ReadonlyMap<string, ReadonlySet<string>>,
): SlugChange[] {
  if (!find) return [];
  const changed = items
    .filter((item) => item.slug.includes(find))
    .map((item) => ({ ...item, newSlug: item.slug.split(find).join(replace) }))
    .filter((item) => item.newSlug !== item.slug);

  const freed = new Map<string, Set<string>>();
  for (const item of changed) {
    const set = freed.get(item.scope) ?? new Set<string>();
    set.add(item.slug);
    freed.set(item.scope, set);
  }
  const claimed = new Map<string, Set<string>>();

  return changed.map((item) => {
    const used = claimed.get(item.scope) ?? new Set<string>();
    claimed.set(item.scope, used);
    let problem: SlugProblem | null = null;
    if (!isValidSlug(item.newSlug)) problem = 'invalid';
    else if (reserved.has(item.newSlug)) problem = 'reserved';
    else if (
      used.has(item.newSlug) ||
      (taken.get(item.scope)?.has(item.newSlug) &&
        !freed.get(item.scope)?.has(item.newSlug))
    ) {
      problem = 'taken';
    }
    used.add(item.newSlug);
    return { ...item, problem };
  });
}
