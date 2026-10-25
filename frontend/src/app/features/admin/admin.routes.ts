import { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell/admin-shell.component';
import { ImportStatusComponent } from './import-status/import-status.component';
import { MissingDataComponent } from './missing-data/missing-data.component';
import { UserListComponent } from './user-list/user-list.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { CommunityListComponent } from './community-list/community-list.component';
import { ReportQueueComponent } from './report-queue/report-queue.component';
import { AuditLogComponent } from './audit-log/audit-log.component';
import { CommunityReviewComponent } from './community-review/community-review.component';

export default [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', redirectTo: 'imports', pathMatch: 'full' as const },
      { path: 'imports', component: ImportStatusComponent },
      {
        path: 'imports/file',
        loadComponent: () =>
          import('./file-import/file-import.component').then((m) => m.FileImportComponent),
      },
      {
        path: 'imports/:id',
        loadComponent: () =>
          import('./import-run/import-run.component').then((m) => m.ImportRunComponent),
      },
      { path: 'users', component: UserListComponent },
      { path: 'communities', component: CommunityListComponent },
      { path: 'communities/:id', component: CommunityReviewComponent },
      { path: 'reports', component: ReportQueueComponent },
      { path: 'audit', component: AuditLogComponent },
      { path: 'missing-data', component: MissingDataComponent },
      { path: 'analytics', component: AnalyticsComponent },
    ],
  },
] satisfies Routes;
