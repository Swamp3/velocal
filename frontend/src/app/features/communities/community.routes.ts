import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./community-list/community-list.component').then((m) => m.CommunityListComponent),
  },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-form/community-form.component').then((m) => m.CommunityFormComponent),
  },
  {
    path: ':slug/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-form/community-form.component').then((m) => m.CommunityFormComponent),
  },
  {
    path: ':slug/members',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-members/community-members.component').then(
        (m) => m.CommunityMembersComponent,
      ),
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./community-detail/community-detail.component').then(
        (m) => m.CommunityDetailComponent,
      ),
  },
];

export default routes;
