import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/theme.service';
import { ToastContainerComponent } from '@shared/ui';

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

  protected readonly mobileMenuOpen = signal(false);
  protected readonly navLinks = NAV_LINKS;
  protected readonly authNav = AUTH_NAV;

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
