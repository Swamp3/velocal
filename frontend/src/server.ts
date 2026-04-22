import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const backendUrl = process.env['BACKEND_INTERNAL_URL'] ?? 'http://backend:3000';
const siteUrl = (process.env['SITE_URL'] ?? 'https://velocal.cc').replace(/\/$/, '');

const allowedHosts = (process.env['NG_ALLOWED_HOSTS'] ?? 'localhost,velocal.cc,www.velocal.cc')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const app = express();
const angularApp = new AngularNodeAppEngine({ allowedHosts });

app.disable('x-powered-by');

// Cheap liveness probe — no Angular render, no backend roundtrip.
app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

// Robots is rendered per-deployment so staging/preview origins don't advertise the prod sitemap.
app.get('/robots.txt', (_req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /auth/',
    'Disallow: /profile',
    'Disallow: /profile/',
    'Disallow: /events/new',
    'Disallow: /events/*/edit',
    'Disallow: /series/new',
    'Disallow: /series/*/edit',
    'Disallow: /news/new',
    'Disallow: /news/*/edit',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
  res
    .type('text/plain')
    .setHeader('Cache-Control', 'public, max-age=3600')
    .send(body);
});

// `app.use('/api', ...)` strips the mount path before handing off to the
// middleware, so we re-anchor the upstream target at `/api` to preserve the
// full path (backend mounts every controller under `/api`).
app.use(
  '/api',
  createProxyMiddleware({
    target: `${backendUrl}/api`,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 300_000,
    timeout: 300_000,
  }),
);

// Sitemap index + shards live at the site root so crawlers can follow relative
// discovery from robots.txt. Rewrite to the backend's `/api/seo/...` namespace.
app.get(
  ['/sitemap.xml', '/sitemap-static.xml', '/sitemap-events.xml', '/sitemap-series.xml', '/sitemap-posts.xml'],
  createProxyMiddleware({
    target: backendUrl,
    changeOrigin: true,
    pathRewrite: (path) => `/api/seo${path}`,
  }),
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\/assets\/i18n\//.test(path)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      }
    },
  }),
);

// Render Angular for anything else. Only anonymous GETs get a CDN cache header;
// anything with auth/cookie state stays uncached so per-user content never leaks.
app.use((req, res, next) => {
  const isCacheable =
    req.method === 'GET' &&
    !req.headers.authorization &&
    !req.headers.cookie;

  angularApp
    .handle(req)
    .then((response) => {
      if (!response) return next();
      if (isCacheable && !res.headersSent) {
        res.setHeader(
          'Cache-Control',
          'public, s-maxage=60, stale-while-revalidate=600',
        );
      }
      return writeResponseToNodeResponse(response, res);
    })
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT']) || 4000;
  app.listen(port, () => {
    console.log(`VeloCal SSR listening on http://0.0.0.0:${port}`);
    console.log(`  proxying /api -> ${backendUrl}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
