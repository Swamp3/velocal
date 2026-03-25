import { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./event-map/event-map.component').then(
        (m) => m.EventMapComponent,
      ),
  },
];

export default routes;
