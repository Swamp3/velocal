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
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
