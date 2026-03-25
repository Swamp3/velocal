import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  {
    path: 'events',
    loadChildren: () => import('./features/events/event.routes'),
  },
  {
    path: 'map',
    loadChildren: () => import('./features/events/map.routes'),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes'),
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/user/user.routes'),
  },
];
