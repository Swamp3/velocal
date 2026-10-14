import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EmptyStateComponent, RequestListComponent, RequestListItem } from '@shared/components';
import { CommunityJoinRequest } from '@shared/models';
import { SkeletonComponent, ToastService } from '@shared/ui';
import { Observable } from 'rxjs';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    SkeletonComponent,
    EmptyStateComponent,
    RequestListComponent,
  ],
  templateUrl: './community-requests.component.html',
})
export class CommunityRequestsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly mutating = signal(false);
  protected readonly backLink = signal<string[]>([]);
  protected readonly backLabel = signal('');
  private readonly requests = signal<CommunityJoinRequest[]>([]);
  private communitySlug = '';
  private subgroupSlug: string | null = null;
  private communityId = '';

  protected readonly requestItems = computed((): RequestListItem[] => {
    this.lang();
    const unnamed = this.transloco.translate('communities.members.unnamed');
    return this.requests().map((request) => ({
      id: request.id,
      name: request.displayName ?? unnamed,
    }));
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    if (!communitySlug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.communitySlug = communitySlug;
    this.subgroupSlug = subgroupSlug;

    if (subgroupSlug) {
      this.communityService
        .getSubgroup(communitySlug, subgroupSlug)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (subgroup) => {
            const members = [
              '/communities',
              subgroup.communitySlug,
              'subgroups',
              subgroup.slug,
              'members',
            ];
            if (!subgroup.viewerIsCommunityAdmin && subgroup.myRole !== 'moderator') {
              void this.router.navigate(members);
              return;
            }
            this.backLink.set(members);
            this.backLabel.set(subgroup.name);
            this.load();
          },
          error: () => {
            this.notFound.set(true);
            this.loading.set(false);
          },
        });
      return;
    }

    this.communityService
      .getBySlug(communitySlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          const members = ['/communities', community.slug, 'members'];
          if (community.myRole !== 'admin') {
            void this.router.navigate(members);
            return;
          }
          this.communityId = community.id;
          this.backLink.set(members);
          this.backLabel.set(community.name);
          this.load();
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onApprove(requestId: string): void {
    this.decide(requestId, 'approve');
  }

  protected onReject(requestId: string): void {
    this.decide(requestId, 'reject');
  }

  private decide(requestId: string, action: 'approve' | 'reject'): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    const subgroupSlug = this.subgroupSlug;
    let request$: Observable<unknown>;
    if (subgroupSlug && action === 'approve') {
      request$ = this.communityService.approveSubgroupRequest(
        this.communitySlug,
        subgroupSlug,
        requestId,
      );
    } else if (subgroupSlug) {
      request$ = this.communityService.rejectSubgroupRequest(
        this.communitySlug,
        subgroupSlug,
        requestId,
      );
    } else if (action === 'approve') {
      request$ = this.communityService.approveRequest(this.communityId, requestId);
    } else {
      request$ = this.communityService.rejectRequest(this.communityId, requestId);
    }
    this.finish(request$);
  }

  private finish(request$: Observable<unknown>): void {
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.load(),
      error: (err: ApiError) => {
        this.mutating.set(false);
        this.toastError(err);
      },
    });
  }

  private load(): void {
    const subgroupSlug = this.subgroupSlug;
    const request$ = subgroupSlug
      ? this.communityService.subgroupJoinRequests(this.communitySlug, subgroupSlug)
      : this.communityService.joinRequests(this.communityId);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.loading.set(false);
        this.mutating.set(false);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.mutating.set(false);
        this.toastError(err);
      },
    });
  }

  private toastError(err: ApiError): void {
    if (err.status >= 500 || err.status === 0 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
