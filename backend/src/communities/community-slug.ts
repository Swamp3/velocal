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
