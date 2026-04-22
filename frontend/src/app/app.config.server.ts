import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { API_BASE_URL } from '@core/tokens/api-base-url';
import { SITE_URL } from '@core/tokens/site-url';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const rawBackend = process.env['BACKEND_INTERNAL_URL'];
const backendBase = rawBackend ?? 'http://backend:3000';

// In production we require an explicit backend URL — falling back silently to
// `http://backend:3000` makes non-docker deploys break with opaque 500s.
if (!rawBackend && process.env['NODE_ENV'] === 'production') {
  throw new Error(
    'BACKEND_INTERNAL_URL is required when NODE_ENV=production (SSR cannot reach the API).',
  );
}

const siteUrl = (process.env['SITE_URL'] ?? 'https://velocal.cc').replace(/\/$/, '');

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_BASE_URL, useValue: `${backendBase}/api` },
    { provide: SITE_URL, useValue: siteUrl },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
