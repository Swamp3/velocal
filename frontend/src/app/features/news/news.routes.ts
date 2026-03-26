import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./news-list/news-list.component').then(
        (m) => m.NewsListComponent,
      ),
  },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./news-form/news-form.component').then(
        (m) => m.NewsFormComponent,
      ),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./news-detail/news-detail.component').then(
        (m) => m.NewsDetailComponent,
      ),
  },
  {
    path: ':slug/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./news-form/news-form.component').then(
        (m) => m.NewsFormComponent,
      ),
  },
];

export default routes;
