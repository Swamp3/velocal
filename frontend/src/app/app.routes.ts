import { Routes } from '@angular/router';
import { adminGuard } from '@core/guards/admin.guard';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes'),
  },
  {
    path: 'events',
    loadChildren: () => import('./features/events/event.routes'),
  },
  {
    path: 'map',
    loadChildren: () => import('./features/events/map.routes'),
  },
  {
    path: 'calendar',
    loadChildren: () => import('./features/events/calendar.routes'),
  },
  {
    path: 'series',
    loadChildren: () => import('./features/series/series.routes'),
  },
  {
    path: 'news',
    loadChildren: () => import('./features/news/news.routes'),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes'),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () => import('./features/user/user.routes'),
  },
  {
    path: 'workouts',
    loadComponent: () =>
      import('./features/workouts/workouts-placeholder.component').then(
        (m) => m.WorkoutsPlaceholderComponent,
      ),
  },
  {
    path: 'impressum',
    loadComponent: () =>
      import('./features/legal/imprint/imprint.component').then(
        (m) => m.ImprintComponent,
      ),
  },
  {
    path: 'datenschutz',
    loadComponent: () =>
      import('./features/legal/privacy/privacy.component').then(
        (m) => m.PrivacyComponent,
      ),
  },
  {
    path: 'nutzungsbedingungen',
    loadComponent: () =>
      import('./features/legal/terms/terms.component').then(
        (m) => m.TermsComponent,
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
