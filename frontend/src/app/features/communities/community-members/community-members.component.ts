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
import {
  EmptyStateComponent,
  InviteByEmailComponent,
  MemberListComponent,
  MemberListItem,
  RequestListComponent,
  RequestListItem,
} from '@shared/components';
import { Community, CommunityJoinRequest, CommunityMember, CommunityRole } from '@shared/models';
import { communityErrorKey } from '../community-error';
import { SkeletonComponent, ToastService } from '@shared/ui';
import { forkJoin, Observable, of } from 'rxjs';

@Component({
  selector: 'app-community-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    SkeletonComponent,
    EmptyStateComponent,
    InviteByEmailComponent,
    MemberListComponent,
    RequestListComponent,
  ],
  templateUrl: './community-members.component.html',
})
export class CommunityMembersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly community = signal<Community | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly mutating = signal(false);
  private readonly members = signal<CommunityMember[]>([]);
  private readonly requests = signal<CommunityJoinRequest[]>([]);

  protected readonly canManage = computed(() => this.community()?.myRole === 'admin');

  protected readonly memberItems = computed((): MemberListItem[] => {
    this.lang();
    const unnamed = this.transloco.translate('communities.members.unnamed');
    return this.members().map((member) => ({
      id: member.userId,
      name: member.displayName ?? unnamed,
      roleLabel: this.transloco.translate(
        member.role === 'admin'
          ? 'communities.members.roleAdmin'
          : 'communities.members.roleMember',
      ),
      roleVariant: member.role === 'admin' ? 'success' : 'neutral',
      toggleLabel: this.canManage()
        ? this.transloco.translate(
            member.role === 'admin'
              ? 'communities.members.demote'
              : 'communities.members.promote',
          )
        : undefined,
      canRemove: this.canManage(),
    }));
  });

  protected readonly requestItems = computed((): RequestListItem[] => {
    this.lang();
    const unnamed = this.transloco.translate('communities.members.unnamed');
    return this.requests().map((request) => ({
      id: request.id,
      name: request.displayName ?? unnamed,
    }));
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.communityService
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          if (!community.myRole) {
            void this.router.navigate(['/communities', community.slug]);
            return;
          }
          this.community.set(community);
          this.loadPeople(community);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onRoleToggle(userId: string): void {
    const community = this.community();
    const member = this.members().find((row) => row.userId === userId);
    if (!community || !member || this.mutating()) return;

    const role: CommunityRole = member.role === 'admin' ? 'member' : 'admin';
    this.mutating.set(true);
    this.communityService
      .updateMemberRole(community.id, userId, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refresh(community.slug),
        error: (err: ApiError) => {
          this.mutating.set(false);
          this.toastMembershipError(err);
        },
      });
  }

  protected onRemove(userId: string): void {
    const community = this.community();
    if (!community || this.mutating()) return;
    if (!window.confirm(this.transloco.translate('communities.members.removeConfirm'))) return;

    this.mutating.set(true);
    this.communityService
      .removeMember(community.id, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refresh(community.slug),
        error: (err: ApiError) => {
          this.mutating.set(false);
          this.toastMembershipError(err);
        },
      });
  }

  protected onInvite(email: string): void {
    const community = this.community();
    if (!community || this.mutating()) return;
    this.mutating.set(true);
    this.communityService
      .invite(community.id, email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('communities.invite.sent'));
          this.refresh(community.slug);
        },
        error: (err: ApiError) => {
          this.mutating.set(false);
          this.toastMembershipError(err);
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
    const community = this.community();
    if (!community || this.mutating()) return;

    this.mutating.set(true);
    const request$: Observable<{ status: 'approved' | 'rejected' }> =
      action === 'approve'
        ? this.communityService.approveRequest(community.id, requestId)
        : this.communityService.rejectRequest(community.id, requestId);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.refresh(community.slug),
      error: (err: ApiError) => {
        this.mutating.set(false);
        this.toastMembershipError(err);
      },
    });
  }

  private refresh(slug: string): void {
    this.communityService
      .getBySlug(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          if (!community.myRole) {
            void this.router.navigate(['/communities', community.slug]);
            return;
          }
          this.community.set(community);
          this.loadPeople(community);
        },
        error: () => {
          void this.router.navigateByUrl('/communities');
        },
      });
  }

  private loadPeople(community: Community): void {
    const requests$ =
      community.myRole === 'admin'
        ? this.communityService.joinRequests(community.id)
        : of<CommunityJoinRequest[]>([]);

    forkJoin({
      members: this.communityService.members(community.id),
      requests: requests$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, requests }) => {
          this.members.set(members);
          this.requests.set(requests);
          this.loading.set(false);
          this.mutating.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.mutating.set(false);
          this.toastMembershipError(err);
        },
      });
  }

  private toastMembershipError(err: ApiError): void {
    if (err.status >= 500 || err.status === 0 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
