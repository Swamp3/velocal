import { Routes } from '@angular/router';
import { AdminShellComponent } from './admin-shell/admin-shell.component';
import { ImportStatusComponent } from './import-status/import-status.component';

export default [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', redirectTo: 'imports', pathMatch: 'full' as const },
      { path: 'imports', component: ImportStatusComponent },
    ],
  },
] satisfies Routes;
