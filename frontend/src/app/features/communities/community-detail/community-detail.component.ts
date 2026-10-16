import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toMetaDescription } from '@shared/utils/meta-text';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { CommunityService } from '@core/services/community.service';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityHeroComponent, EmptyStateComponent, RichTextViewComponent, ShareButtonComponent } from '@shared/components';
import { communityErrorKey } from '../community-error';
import { ReportDialogComponent } from '../report-dialog/report-dialog.component';
import {
  CommunitySectionLink,
  CommunitySectionNavComponent,
} from '../community-section-nav/community-section-nav.component';
import { CommunityEventsComponent } from '../community-events/community-events.component';
import { Community, CommunityVisibility, communityVisibilityVariant } from '@shared/models';
import { BadgeComponent, ButtonComponent, ButtonStyleDirective, SkeletonComponent, ToastService } from '@shared/ui';

@Component({
  selector: 'app-community-detail',
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
    CommunityEventsComponent,
    ReportDialogComponent, ButtonStyleDirective, ButtonStyleDirective, ShareButtonComponent,
  ],
  templateUrl: './community-detail.component.html',
})
export class CommunityDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly community = signal<Community | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly acting = signal(false);
  protected readonly reporting = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.fail();
      return;
    }

    this.communityService
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          this.community.set(community);
          this.loading.set(false);
          this.applySeo(community);
        },
        error: () => this.fail(),
      });
  }

  protected visibilityVariant(visibility: CommunityVisibility) {
    return communityVisibilityVariant(visibility);
  }

  protected sections(community: Community): CommunitySectionLink[] {
    const base = ['/communities', community.slug];
    const links: CommunitySectionLink[] = [
      {
        icon: 'groups',
        labelKey: 'communities.subgroups.title',
        commands: [...base, 'subgroups'],
        count: community.subgroupCount,
      },
    ];
    if (!community.myRole) return links;
    return [
      ...links,
      {
        icon: 'forum',
        labelKey: 'communities.posts.title',
        commands: [...base, 'posts'],
        count: community.postCount,
      },
      {
        icon: 'ballot',
        labelKey: 'communities.polls.title',
        commands: [...base, 'polls'],
        count: community.pollCount,
      },
      {
        icon: 'group',
        labelKey: 'communities.members.title',
        commands: [...base, 'members'],
        count: community.memberCount,
        pending: community.pendingRequestCount,
      },
    ];
  }

  protected join(): void {
    const community = this.community();
    if (!community || this.acting()) return;

    this.acting.set(true);
    this.communityService
      .join(community.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.outcome === 'joined') {
            this.community.set(result.community);
            this.applySeo(result.community);
            this.toast.success(this.transloco.translate('communities.joined'));
          } else {
            this.community.update((current) =>
              current ? { ...current, myJoinRequest: 'pending' } : current,
            );
            this.toast.success(this.transloco.translate('communities.requested'));
          }
          this.acting.set(false);
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.toastUnlessTransport(err);
        },
      });
  }

  protected leave(): void {
    const community = this.community();
    if (!community || this.acting()) return;
    if (!window.confirm(this.transloco.translate('communities.leaveConfirm'))) return;

    this.acting.set(true);
    this.communityService
      .leave(community.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('communities.left'));
          this.communityService
            .getBySlug(community.slug)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (updated) => {
                this.community.set(updated);
                this.applySeo(updated);
                this.acting.set(false);
              },
              error: () => {
                void this.router.navigateByUrl('/communities');
              },
            });
        },
        error: (err: ApiError) => {
          this.acting.set(false);
          this.toastUnlessTransport(err);
        },
      });
  }

  private fail(): void {
    this.error.set(true);
    this.loading.set(false);
    this.seo.setMeta({
      title: this.transloco.translate('communities.notFoundTitle'),
      description: this.transloco.translate('communities.notFoundMessage'),
      noindex: true,
    });
  }

  private applySeo(community: Community): void {
    const description = toMetaDescription(community.description) || community.name;
    this.seo.setMeta({
      title: community.name,
      description,
      url: this.seo.pageUrl(`/communities/${community.slug}`),
      image: this.seo.ogImage(community.heroUrl),
      type: 'website',
    });
  }

  /** 401/5xx/offline already toast in the error interceptor. */
  private toastUnlessTransport(err: ApiError): void {
    if (err.status >= 500 || err.status === 0 || err.status === 401 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
