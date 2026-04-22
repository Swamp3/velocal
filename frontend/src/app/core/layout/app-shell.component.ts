import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { SeoService } from '@core/services/seo.service';
import { ThemeService } from '@core/theme.service';
import { ToastContainerComponent } from '@shared/ui';
import { version as APP_VERSION } from '../../../../package.json';

interface NavLink {
  path: string;
  key: string;
}

const NAV_LINKS: NavLink[] = [
  { path: '/news', key: 'app.nav.news' },
  { path: '/events', key: 'app.nav.events' },
  { path: '/calendar', key: 'app.nav.calendar' },
  { path: '/map', key: 'app.nav.map' },
  { path: '/series', key: 'app.nav.series' },
];

const AUTH_NAV: NavLink = { path: '/profile', key: 'app.nav.profile' };

interface RouteSeo {
  title: string;
  description: string;
  /** Canonical URL path (relative to the site origin). */
  canonical?: string;
}

/**
 * Whitelist of query-string keys that produce legitimate canonical variants (filter pages).
 * Any route carrying only whitelisted params stays indexable; anything else gets noindex.
 */
const INDEXABLE_QUERY_PARAMS = new Set([
  'disc',
  'discipline',
  'from',
  'to',
  'q',
  'country',
  'zip',
  'radius',
  'year',
  'lang',
  'sort',
  'page',
]);

const ROUTE_SEO_TABLE: Array<{ test: (path: string) => boolean; seo: RouteSeo }> = [
  {
    test: (p) => p === '/' || p.startsWith('/events'),
    seo: {
      title: 'VeloCal — Cycling events',
      description: 'Discover cycling races, tours and events across Europe.',
      canonical: '/events',
    },
  },
  {
    test: (p) => p.startsWith('/series'),
    seo: {
      title: 'VeloCal — Race series',
      description: 'Browse cycling race series.',
      canonical: '/series',
    },
  },
  {
    test: (p) => p.startsWith('/news'),
    seo: {
      title: 'VeloCal — News',
      description: 'Latest cycling news and updates.',
      canonical: '/news',
    },
  },
  {
    test: (p) => p.startsWith('/calendar'),
    seo: {
      title: 'VeloCal — Calendar',
      description: 'Month view of cycling events.',
      canonical: '/calendar',
    },
  },
  {
    test: (p) => p.startsWith('/map'),
    seo: {
      title: 'VeloCal — Cycling map',
      description: 'Browse cycling events on a map.',
      canonical: '/map',
    },
  },
];

const DEFAULT_SEO: RouteSeo = {
  title: 'VeloCal',
  description: 'VeloCal — Cycling event calendar',
};

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, TranslocoPipe],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mobileMenuOpen = signal(false);
  protected readonly navLinks = NAV_LINKS;
  protected readonly authNav = AUTH_NAV;
  protected readonly appVersion = APP_VERSION;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.applyRouteDefaults(e.urlAfterRedirects));
  }

  private applyRouteDefaults(url: string): void {
    const [rawPath, rawQuery] = url.split('?');
    const path = rawPath ?? '/';

    // Detail pages own their own SEO — but exclude editor/new routes so those fall through
    // to the shell's noindex branch and the detail component never overwrites them.
    const isDetail =
      /^\/(events|series|news)\/[^/]+$/.test(path) &&
      !/^\/(events|series|news)\/(new|edit)$/.test(path) &&
      !path.endsWith('/edit');
    if (isDetail) return;

    const editish = /\/(new|edit)(\/|$)/.test(path) || /^\/(auth|profile)/.test(path);
    const hasDisallowedQuery = !!rawQuery && this.hasDisallowedParams(rawQuery);

    const entry = ROUTE_SEO_TABLE.find(({ test }) => test(path))?.seo ?? DEFAULT_SEO;

    this.seo.setMeta({
      title: entry.title,
      description: entry.description,
      url: entry.canonical ? this.seo.pageUrl(entry.canonical) : this.seo.pageUrl('/'),
      type: 'website',
      noindex: editish || hasDisallowedQuery,
    });
  }

  private hasDisallowedParams(query: string): boolean {
    const params = new URLSearchParams(query);
    for (const key of params.keys()) {
      if (!INDEXABLE_QUERY_PARAMS.has(key)) return true;
    }
    return false;
  }

  protected toggleLang(): void {
    const next = this.transloco.getActiveLang() === 'de' ? 'en' : 'de';
    this.transloco.setActiveLang(next);
  }

  protected activeLang(): string {
    return this.transloco.getActiveLang();
  }

  protected onLogout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/events');
  }
}
