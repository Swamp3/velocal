import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'events',
    loadComponent: () => import('./my-events/my-events.component').then((m) => m.MyEventsComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./profile/profile.component').then((m) => m.ProfileComponent),
  },
];

export default routes;
