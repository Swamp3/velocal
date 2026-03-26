import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./series-list/series-list.component').then(
        (m) => m.SeriesListComponent,
      ),
  },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./series-form/series-form.component').then(
        (m) => m.SeriesFormComponent,
      ),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./series-detail/series-detail.component').then(
        (m) => m.SeriesDetailComponent,
      ),
  },
  {
    path: ':slug/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./series-form/series-form.component').then(
        (m) => m.SeriesFormComponent,
      ),
  },
];

export default routes;
