import { isIP } from 'node:net';

/**
 * Push services of the browser and OS vendors. The server only ever sends to
 * these hosts, so a stored endpoint cannot point it at an internal address.
 * Extra hosts can be added with PUSH_ENDPOINT_HOSTS (comma separated; a leading
 * dot matches subdomains).
 */
const DEFAULT_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  '.push.services.mozilla.com',
  'push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
];

export function isAllowedPushEndpoint(
  endpoint: string,
  extraHosts: string[] = [],
): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (isIP(host) || host.startsWith('[') || !host.includes('.')) return false;
  if (url.port && url.port !== '443') return false;
  return [...DEFAULT_HOSTS, ...extraHosts].some((allowed) =>
    allowed.startsWith('.')
      ? host.endsWith(allowed) || host === allowed.slice(1)
      : host === allowed,
  );
}
