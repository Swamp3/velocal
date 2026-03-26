import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./event-list/event-list.component').then(
        (m) => m.EventListComponent,
      ),
  },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./event-form/event-form.component').then(
        (m) => m.EventFormComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./event-detail/event-detail.component').then(
        (m) => m.EventDetailComponent,
      ),
  },
  {
    path: ':id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./event-form/event-form.component').then(
        (m) => m.EventFormComponent,
      ),
  },
];

export default routes;
