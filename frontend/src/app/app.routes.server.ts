import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Per-route render strategy.
 *
 * - `Client` for anything gated behind auth or interactive editors — no SEO value,
 *   and SSR would just burn CPU producing the anonymous/empty variant.
 * - `Server` for everything else so crawlers see route-specific `<head>`.
 *
 * Prerendering is intentionally avoided for now: every list/detail page fetches
 * from the API, so prerender at build time would require a live backend and
 * would need manual param discovery for the detail routes. Revisit once we
 * introduce truly static marketing pages.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'auth/**', renderMode: RenderMode.Client },
  { path: 'profile/**', renderMode: RenderMode.Client },

  { path: 'events/new', renderMode: RenderMode.Client },
  { path: 'events/:id/edit', renderMode: RenderMode.Client },

  { path: 'series/new', renderMode: RenderMode.Client },
  { path: 'series/:slug/edit', renderMode: RenderMode.Client },

  { path: 'news/new', renderMode: RenderMode.Client },
  { path: 'news/:slug/edit', renderMode: RenderMode.Client },

  { path: '**', renderMode: RenderMode.Server },
];
