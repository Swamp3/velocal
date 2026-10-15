import { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell/admin-shell.component';
import { ImportStatusComponent } from './import-status/import-status.component';
import { MissingDataComponent } from './missing-data/missing-data.component';
import { UserListComponent } from './user-list/user-list.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { CommunityListComponent } from './community-list/community-list.component';
import { CommunityReviewComponent } from './community-review/community-review.component';

export default [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', redirectTo: 'imports', pathMatch: 'full' as const },
      { path: 'imports', component: ImportStatusComponent },
      { path: 'users', component: UserListComponent },
      { path: 'communities', component: CommunityListComponent },
      { path: 'communities/:id', component: CommunityReviewComponent },
      { path: 'missing-data', component: MissingDataComponent },
      { path: 'analytics', component: AnalyticsComponent },
    ],
  },
] satisfies Routes;
