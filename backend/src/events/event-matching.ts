/**
 * Helpers that decide whether two event records describe the same real event.
 * Used by the importer (to avoid creating duplicates) and by the admin
 * duplicate finder.
 */

export interface MatchableEvent {
  name: string;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type MatchReason =
  'sameName' | 'similarName' | 'sameLocation' | 'nearby';

export interface MatchResult {
  match: boolean;
  score: number;
  reasons: MatchReason[];
}

/** Lower case, no accents or punctuation, no years or edition numbers. */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b\d{1,3}\s*\.(?=\s|$)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function bigrams(text: string): Map<string, number> {
  const compact = text.replace(/\s/g, '');
  const grams = new Map<string, number>();
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Dice coefficient on character bigrams, 0..1. */
export function similarity(a: string, b: string): number {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  // "Rund um Köln" vs "Rund um Köln Elite Männer": one contains the other.
  if (shorter.length >= 8 && longer.includes(shorter)) return 0.92;
  const gx = bigrams(x);
  const gy = bigrams(y);
  let overlap = 0;
  for (const [gram, count] of gx) {
    overlap += Math.min(count, gy.get(gram) ?? 0);
  }
  const total =
    [...gx.values()].reduce((s, n) => s + n, 0) +
    [...gy.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function distanceKm(
  a: { lat?: number | null; lng?: number | null },
  b: { lat?: number | null; lng?: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return null;
  }
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

const CLASS_WORDS =
  /\b(u\s?\d{2}|elite|frauen|damen|herren|m(?:ä|ae)nner|junior(?:en|innen)?|jugend|masters?(?:\s?\d)?|sch(?:ü|ue)ler(?:\s[a-d])?|nachwuchs|senioren|bambini)\b/g;
const ROUND_BEFORE =
  /\b(\d{1,3})\s*\.?\s*(spieltag|lauf|runde|etappe|durchgang|vorrunde)\b/g;
const ROUND_AFTER =
  /\b(spieltag|lauf|staffel|gruppe|runde|etappe|durchgang)\s*(\d{1,3}(?:\s*(?:-|und|\/)\s*\d{1,3})?)\b/g;

/**
 * Words that tell two competitions on the same day and place apart: age or rating class
 * (U13, Elite, Frauen) and round or group (2. Spieltag, Staffel 1, Gruppe 2 - 4). Normalised
 * text drops them, so they are compared separately.
 */
export function distinguishingTokens(name: string): Set<string> {
  const text = name.toLowerCase().replace(/\s+/g, ' ');
  const tokens = new Set<string>();
  for (const m of text.matchAll(CLASS_WORDS))
    tokens.add(m[1].replace(/\s/g, ''));
  for (const m of text.matchAll(ROUND_BEFORE)) tokens.add(`${m[2]}:${m[1]}`);
  for (const m of text.matchAll(ROUND_AFTER)) {
    tokens.add(`${m[1]}:${m[2].replace(/\s+/g, '').replace('und', '/')}`);
  }
  return tokens;
}

function sameTokens(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((token) => b.has(token));
}

/**
 * Two events on the same day are the same event when their names are almost
 * identical, or fairly similar and at the same place. Names that name different
 * classes or rounds (U13 vs U17, Staffel 1 vs Staffel 2) are never the same event.
 */
export function compareEvents(
  a: MatchableEvent,
  b: MatchableEvent,
): MatchResult {
  const name = similarity(a.name, b.name);
  const place = similarity(a.locationName ?? '', b.locationName ?? '');
  const km = distanceKm(a, b);
  const sameName = normalizeText(a.name) === normalizeText(b.name);
  const samePlace = place >= 0.6;
  const near = km !== null && km <= 3;

  const reasons: MatchReason[] = [];
  if (sameName) reasons.push('sameName');
  else if (name >= 0.6) reasons.push('similarName');
  if (samePlace) reasons.push('sameLocation');
  if (near) reasons.push('nearby');

  const tokensA = distinguishingTokens(a.name);
  const tokensB = distinguishingTokens(b.name);
  const differentClass =
    tokensA.size > 0 && tokensB.size > 0 && !sameTokens(tokensA, tokensB);

  const match =
    !differentClass &&
    (name >= 0.85 ||
      (name >= 0.6 && (samePlace || near)) ||
      (name >= 0.45 && samePlace && near));
  const score = Math.min(1, name * 0.7 + Math.max(place, near ? 0.8 : 0) * 0.3);
  return { match, score, reasons };
}
