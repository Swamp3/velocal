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
    path: ':slug/posts/:postId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post/community-post.component').then((m) => m.CommunityPostComponent),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/posts/:postId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post/community-post.component').then((m) => m.CommunityPostComponent),
  },
  {
    path: ':slug/subgroups/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./subgroup-form/subgroup-form.component').then((m) => m.SubgroupFormComponent),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./subgroup-form/subgroup-form.component').then((m) => m.SubgroupFormComponent),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/members',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./subgroup-members/subgroup-members.component').then(
        (m) => m.SubgroupMembersComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug',
    loadComponent: () =>
      import('./subgroup-detail/subgroup-detail.component').then((m) => m.SubgroupDetailComponent),
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
