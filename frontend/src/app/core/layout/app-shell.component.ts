import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  untracked,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LocaleService } from '@core/services/locale.service';
import { NotificationService } from '@core/services/notification.service';
import { PushService } from '@core/services/push.service';
import { SeoService } from '@core/services/seo.service';
import { UserService } from '@core/services/user.service';
import { ThemeService } from '@core/theme.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';
import { filter } from 'rxjs';
import { NavDropdownComponent } from './nav-dropdown/nav-dropdown.component';
import { UpdateBannerComponent } from './update-banner/update-banner.component';
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
  { path: '/communities', key: 'app.nav.communities' },
  // { path: '/series', key: 'app.nav.series' },
];

/** Desktop groups these under one "Events" dropdown; mobile lists them flat. */
const EVENT_LINKS = [
  { path: '/events', key: 'app.nav.eventList', icon: 'list' },
  { path: '/calendar', key: 'app.nav.calendar', icon: 'calendar_month' },
  { path: '/map', key: 'app.nav.map', icon: 'map' },
];
const USER_PATHS = /^\/(profile|routes|admin)(\/|$)/;

const ADMIN_NAV: NavLink = { path: '/admin', key: 'app.nav.admin' };
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
    test: (p) => p.startsWith('/communities'),
    seo: {
      title: 'VeloCal — Communities',
      description: 'Find and join cycling communities.',
      canonical: '/communities',
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
  imports: [
    NavDropdownComponent,
    UpdateBannerComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastContainerComponent,
    TranslocoPipe,
  ],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);
  private readonly push = inject(PushService);

  protected readonly unreadCount = this.notifications.unread;

  protected readonly mobileMenuOpen = signal(false);
  protected readonly isFullViewport = signal(false);
  protected readonly navLinks = NAV_LINKS;
  protected readonly eventLinks = EVENT_LINKS;
  protected readonly currentUrl = signal('/');
  protected readonly eventsGroupActive = computed(() =>
    EVENT_LINKS.some((link) => this.currentUrl().startsWith(link.path)),
  );
  protected readonly userGroupActive = computed(() => USER_PATHS.test(this.currentUrl()));
  protected readonly topLinkClass =
    'rounded-lg px-3.5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] transition-all duration-200';
  protected readonly menuItemClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] transition-colors';
  protected readonly adminNav = ADMIN_NAV;
  protected readonly authNav = AUTH_NAV;
  protected readonly appVersion = APP_VERSION;
  protected readonly currentYear = new Date().getFullYear();

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.isFullViewport.set(/^\/map(\?|$)/.test(e.urlAfterRedirects));
        this.applyRouteDefaults(e.urlAfterRedirects);
        this.refreshUnread();
      });

    effect(() => {
      if (!this.auth.hydrated()) return;
      this.auth.currentUser();
      this.refreshUnread();
      // Re-register this device's push subscription after every sign-in/start.
      if (this.auth.isAuthenticated()) untracked(() => void this.push.refresh());
    });
  }

  private refreshUnread(): void {
    if (this.auth.isAuthenticated()) this.notifications.refreshUnread();
    else this.notifications.unread.set(0);
  }

  private applyRouteDefaults(url: string): void {
    const [rawPath, rawQuery] = url.split('?');
    const path = rawPath ?? '/';

    // Detail pages own their own SEO — but exclude editor/new routes so those fall through
    // to the shell's noindex branch and the detail component never overwrites them.
    const isDetail =
      /^\/(events|series|news|communities)\/[^/]+$/.test(path) &&
      !/^\/(events|series|news|communities)\/(new|edit)$/.test(path) &&
      !path.endsWith('/edit');
    if (isDetail) return;

    const isLegal = /^\/(impressum|datenschutz|nutzungsbedingungen)/.test(path);
    if (isLegal) return;

    const editish =
      /\/(new|edit|members)(\/|$)/.test(path) || /^\/(auth|profile|admin|notifications)/.test(path);
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
    const next = (this.transloco.getActiveLang() === 'de' ? 'en' : 'de') as 'de' | 'en';
    this.localeService.setLanguage(next);

    if (this.auth.isAuthenticated()) {
      this.userService.updateProfile({ preferredLanguage: next }).subscribe({
        next: (user) => this.auth.updateCurrentUser(user),
      });
    }
  }

  protected activeLang(): string {
    return this.transloco.getActiveLang();
  }

  protected onLogout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/events');
  }
}
