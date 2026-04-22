import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';

/**
 * Public origin of the site (e.g. `https://velocal.cc`).
 *
 * Resolved in this order:
 * 1. Provider override (set server-side from `SITE_URL` env).
 * 2. `window.location.origin` in the browser.
 * 3. Empty string — only reachable in non-browser test doubles without a
 *    provider override; callers treat it as "no canonical origin available"
 *    and either skip the URL or fall back to a hard-coded production origin.
 */
export const SITE_URL = new InjectionToken<string>('SITE_URL', {
  providedIn: 'root',
  factory: () => {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      return inject(DOCUMENT).defaultView!.location.origin;
    }
    return '';
  },
});
