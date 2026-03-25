import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/theme.service';
import { TranslocoService } from '@jsverse/transloco';
import { ToastContainerComponent } from '@shared/ui';

interface NavLink {
  path: string;
  labelDe: string;
  labelEn: string;
}

const NAV_LINKS: NavLink[] = [
  { path: '/events', labelDe: 'Events', labelEn: 'Events' },
  { path: '/map', labelDe: 'Karte', labelEn: 'Map' },
];

const AUTH_NAV: NavLink = { path: '/profile', labelDe: 'Profil', labelEn: 'Profile' };

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
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

  protected activeLang(): string {
    return this.transloco.getActiveLang();
  }

  protected toggleLang(): void {
    const next = this.transloco.getActiveLang() === 'de' ? 'en' : 'de';
    this.transloco.setActiveLang(next);
  }

  protected onLogout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/events');
  }
}
