import { InjectionToken } from '@angular/core';
import { environment } from '@env';

/**
 * Base URL for API calls.
 *
 * Browser: relative `/api` (set in `app.config.ts`).
 * Server (SSR): absolute URL to the backend service (set in `app.config.server.ts`).
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
