import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IconButtonComponent } from '@shared/ui';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

interface AdminNavItem {
  path: string;
  key: string;
  icon: string;
}

const NAV_ITEMS: AdminNavItem[] = [
  { path: 'imports', key: 'admin.nav.imports', icon: 'cloud_sync' },
  { path: 'users', key: 'admin.nav.users', icon: 'group' },
  { path: 'communities', key: 'admin.nav.communities', icon: 'diversity_3' },
  { path: 'reports', key: 'admin.nav.reports', icon: 'flag' },
  { path: 'missing-data', key: 'admin.nav.missingData', icon: 'report' },
  { path: 'analytics', key: 'admin.nav.analytics', icon: 'analytics' },
  { path: 'audit', key: 'admin.nav.audit', icon: 'history' },
];

@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, IconButtonComponent],
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent {
  protected readonly navItems = NAV_ITEMS;
  protected readonly sidebarCollapsed = signal(false);
}
