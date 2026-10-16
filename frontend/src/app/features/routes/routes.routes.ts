import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./route-list/route-list.component').then((m) => m.RouteListComponent),
  },
  {
    path: ':id/files/:fileId',
    loadComponent: () =>
      import('./route-map/route-map.component').then((m) => m.RouteMapComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./route-detail/route-detail.component').then((m) => m.RouteDetailComponent),
  },
];

export default routes;
