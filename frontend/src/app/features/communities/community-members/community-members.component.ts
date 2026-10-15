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
} from '@shared/components';
import { Community, CommunityMember, CommunityRole } from '@shared/models';
import { communityErrorKey } from '../community-error';
import { SkeletonComponent, ToastService } from '@shared/ui';

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
  protected readonly outlineLinkClass =
    'inline-flex items-center justify-center rounded-[var(--radius-default)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';
  private readonly members = signal<CommunityMember[]>([]);

  protected readonly canManage = computed(() => this.community()?.myRole === 'admin');

  protected readonly memberItems = computed((): MemberListItem[] => {
    this.lang();
    const unnamed = this.transloco.translate('communities.members.unnamed');
    return this.members().map((member) => ({
      id: member.userId,
      name: member.displayName ?? unnamed,
      stravaUrl: member.stravaUrl,
      roleLabel: this.transloco.translate(
        member.role === 'admin'
          ? 'communities.members.roleAdmin'
          : 'communities.members.roleMember',
      ),
      roleVariant: member.role === 'admin' ? 'success' : 'neutral',
      toggleLabel: this.canManage()
        ? this.transloco.translate(
            member.role === 'admin' ? 'communities.members.demote' : 'communities.members.promote',
          )
        : undefined,
      canRemove: this.canManage(),
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
    this.communityService
      .members(community.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
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
