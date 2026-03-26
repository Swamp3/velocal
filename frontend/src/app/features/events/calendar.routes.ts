import { Routes } from '@angular/router';

const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./event-calendar/event-calendar.component').then((m) => m.EventCalendarComponent),
    },
];

export default routes;
