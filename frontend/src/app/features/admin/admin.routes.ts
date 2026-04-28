import { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell/admin-shell.component';
import { ImportStatusComponent } from './import-status/import-status.component';
import { MissingDataComponent } from './missing-data/missing-data.component';
import { UserListComponent } from './user-list/user-list.component';

export default [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', redirectTo: 'imports', pathMatch: 'full' as const },
      { path: 'imports', component: ImportStatusComponent },
      { path: 'users', component: UserListComponent },
      { path: 'missing-data', component: MissingDataComponent },
    ],
  },
] satisfies Routes;
