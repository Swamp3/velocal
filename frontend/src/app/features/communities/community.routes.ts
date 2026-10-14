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
    path: ':slug/posts/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post-form/community-post-form.component').then(
        (m) => m.CommunityPostFormComponent,
      ),
  },
  {
    path: ':slug/polls/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-poll-form/community-poll-form.component').then(
        (m) => m.CommunityPollFormComponent,
      ),
  },
  {
    path: ':slug/events/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../events/event-form/event-form.component').then((m) => m.EventFormComponent),
  },
  {
    path: ':slug/requests',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-requests/community-requests.component').then(
        (m) => m.CommunityRequestsComponent,
      ),
  },
  {
    path: ':slug/posts',
    canActivate: [authGuard],
    data: { section: 'posts' },
    loadComponent: () =>
      import('./community-section/community-section.component').then(
        (m) => m.CommunitySectionComponent,
      ),
  },
  {
    path: ':slug/polls',
    canActivate: [authGuard],
    data: { section: 'polls' },
    loadComponent: () =>
      import('./community-section/community-section.component').then(
        (m) => m.CommunitySectionComponent,
      ),
  },
  {
    path: ':slug/posts/:postId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post/community-post.component').then((m) => m.CommunityPostComponent),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/posts/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post-form/community-post-form.component').then(
        (m) => m.CommunityPostFormComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/polls/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-poll-form/community-poll-form.component').then(
        (m) => m.CommunityPollFormComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/events/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../events/event-form/event-form.component').then((m) => m.EventFormComponent),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/requests',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-requests/community-requests.component').then(
        (m) => m.CommunityRequestsComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/posts',
    canActivate: [authGuard],
    data: { section: 'posts' },
    loadComponent: () =>
      import('./community-section/community-section.component').then(
        (m) => m.CommunitySectionComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/polls',
    canActivate: [authGuard],
    data: { section: 'polls' },
    loadComponent: () =>
      import('./community-section/community-section.component').then(
        (m) => m.CommunitySectionComponent,
      ),
  },
  {
    path: ':slug/subgroups/:subgroupSlug/posts/:postId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./community-post/community-post.component').then((m) => m.CommunityPostComponent),
  },
  {
    path: ':slug/subgroups',
    loadComponent: () =>
      import('./community-subgroups/community-subgroups.component').then(
        (m) => m.CommunitySubgroupsComponent,
      ),
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
