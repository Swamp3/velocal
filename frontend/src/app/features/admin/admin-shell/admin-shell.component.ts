import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
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
  { path: 'missing-data', key: 'admin.nav.missingData', icon: 'report' },
];

@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  templateUrl: './admin-shell.component.html',
})
export class AdminShellComponent {
  protected readonly navItems = NAV_ITEMS;
  protected readonly sidebarCollapsed = signal(false);
}
