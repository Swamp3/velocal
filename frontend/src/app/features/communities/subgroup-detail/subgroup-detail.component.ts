import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CommunityHeroComponent,
  EmptyStateComponent,
  RichTextViewComponent,
} from '@shared/components';
import {
  CommunitySectionLink,
  CommunitySectionNavComponent,
} from '../community-section-nav/community-section-nav.component';
import { CommunityEventsComponent } from '../community-events/community-events.component';
import { Subgroup, SubgroupVisibility, subgroupVisibilityVariant } from '@shared/models';
import { BadgeComponent, ButtonComponent, ButtonStyleDirective, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-subgroup-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    BadgeComponent,
    ButtonComponent,
    SkeletonComponent,
    CommunityHeroComponent,
    EmptyStateComponent,
    RichTextViewComponent,
    CommunitySectionNavComponent,
    CommunityEventsComponent, ButtonStyleDirective,
  ],
  templateUrl: './subgroup-detail.component.html',
})
export class SubgroupDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly subgroup = signal<Subgroup | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly acting = signal(false);

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const slug = this.route.snapshot.paramMap.get('subgroupSlug');
    if (!communitySlug || !slug) {
      this.fail();
      return;
    }

    this.communityService
      .getSubgroup(communitySlug, slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subgroup) => {
          this.subgroup.set(subgroup);
          this.loading.set(false);
        },
        error: () => this.fail(),
      });
  }

  protected visibilityVariant(visibility: SubgroupVisibility) {
    return subgroupVisibilityVariant(visibility);
  }

  protected canEdit(subgroup: Subgroup): boolean {
    return subgroup.viewerIsCommunityAdmin || subgroup.myRole === 'moderator';
  }

  protected sections(subgroup: Subgroup): CommunitySectionLink[] {
    if (!subgroup.myRole && !subgroup.viewerIsCommunityAdmin) return [];
    const base = ['/communities', subgroup.communitySlug, 'subgroups', subgroup.slug];
    return [
      {
        icon: 'forum',
        labelKey: 'communities.posts.title',
        commands: [...base, 'posts'],
        count: subgroup.postCount,
      },
      {
        icon: 'ballot',
        labelKey: 'communities.polls.title',
        commands: [...base, 'polls'],
        count: subgroup.pollCount,
      },
      {
        icon: 'group',
        labelKey: 'communities.members.title',
        commands: [...base, 'members'],
        count: subgroup.memberCount,
      },
    ];
  }

  protected join(): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.acting()) return;
    this.acting.set(true);
    this.communityService
      .joinSubgroup(subgroup.communitySlug, subgroup.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.outcome === 'joined') {
            this.subgroup.set(result.subgroup);
            this.toast.success(this.transloco.translate('communities.subgroups.joined'));
          } else {
            this.subgroup.update((current) =>
              current ? { ...current, myJoinRequest: 'pending' } : current,
            );
            this.toast.success(this.transloco.translate('communities.requested'));
          }
          this.acting.set(false);
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.toastError(err);
        },
      });
  }

  protected leave(): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.acting()) return;
    if (!window.confirm(this.transloco.translate('communities.subgroups.leaveConfirm'))) return;
    this.acting.set(true);
    this.communityService
      .leaveSubgroup(subgroup.communitySlug, subgroup.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('communities.subgroups.left'));
          void this.router.navigate(['/communities', subgroup.communitySlug]);
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.toastError(err);
        },
      });
  }

  private fail(): void {
    this.error.set(true);
    this.loading.set(false);
  }

  private toastError(err: ApiError): void {
    if (err.status >= 500 || err.status === 0 || err.status === 401 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
