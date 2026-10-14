import { createHmac, timingSafeEqual } from 'node:crypto';

/** Binds a URL to one upload subject and id so every variant shares the token. */
export function imageAccessToken(
  subject: string,
  id: string,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(`${subject}:${id}`)
    .digest('base64url');
}

export function imageAccessMatches(
  subject: string,
  id: string,
  token: string | undefined,
  secret: string,
): boolean {
  if (!token) return false;
  const expected = Buffer.from(imageAccessToken(subject, id, secret));
  const given = Buffer.from(token);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * Appends `access` when the image must not be fetched from the bare URL.
 * `<img>` cannot send the bearer token, so the query string is the capability.
 */
export function signImageUrl(
  url: string | null,
  restricted: boolean,
  secret: string,
): string | null {
  if (!url || !restricted) return url;
  const match = url.match(/\/api\/uploads\/([^/?]+)\/([^/?]+)\//);
  if (!match) return url;
  const token = imageAccessToken(match[1], match[2], secret);
  return `${url}${url.includes('?') ? '&' : '?'}access=${token}`;
}
