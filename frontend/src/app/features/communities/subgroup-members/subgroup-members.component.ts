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
import { EmptyStateComponent, MemberListComponent, MemberListItem } from '@shared/components';
import { CommunityMember, Subgroup, SubgroupMember, SubgroupRole } from '@shared/models';
import { ButtonStyleDirective, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-subgroup-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, SkeletonComponent, EmptyStateComponent, MemberListComponent, ButtonStyleDirective],
  templateUrl: './subgroup-members.component.html',
})
export class SubgroupMembersComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly subgroup = signal<Subgroup | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly mutating = signal(false);
  private readonly members = signal<SubgroupMember[]>([]);
  private readonly communityMembers = signal<CommunityMember[]>([]);
  protected readonly query = signal('');

  /** Community members who are not in the subgroup yet, narrowed by the typed text. */
  protected readonly suggestions = computed(() => {
    const inGroup = new Set(this.members().map((member) => member.userId));
    const needle = this.query().trim().toLowerCase();
    if (!needle) return [];
    const unnamed = this.transloco.translate('communities.members.unnamed');
    return this.communityMembers()
      .filter((member) => !inGroup.has(member.userId))
      .map((member) => ({ userId: member.userId, name: member.displayName ?? unnamed }))
      .filter((member) => member.name.toLowerCase().includes(needle))
      .slice(0, 8);
  });

  protected readonly canManage = computed(() => {
    const subgroup = this.subgroup();
    return !!subgroup && (subgroup.viewerIsCommunityAdmin || subgroup.myRole === 'moderator');
  });

  protected readonly memberItems = computed((): MemberListItem[] => {
    this.lang();
    const subgroup = this.subgroup();
    const unnamed = this.transloco.translate('communities.members.unnamed');
    const isAdmin = !!subgroup?.viewerIsCommunityAdmin;
    return this.members().map((member) => ({
      id: member.userId,
      name: member.displayName ?? unnamed,
      stravaUrl: member.stravaUrl,
      roleLabel: this.transloco.translate(
        member.role === 'moderator'
          ? 'communities.subgroups.roleModerator'
          : 'communities.members.roleMember',
      ),
      roleVariant: member.role === 'moderator' ? 'warning' : 'neutral',
      toggleLabel: isAdmin
        ? this.transloco.translate(
            member.role === 'moderator'
              ? 'communities.subgroups.demote'
              : 'communities.subgroups.promote',
          )
        : undefined,
      canRemove: isAdmin,
    }));
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const slug = this.route.snapshot.paramMap.get('subgroupSlug');
    if (!communitySlug || !slug) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.communityService
      .getSubgroup(communitySlug, slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subgroup) => {
          if (!subgroup.myRole && !subgroup.viewerIsCommunityAdmin) {
            void this.router.navigate([
              '/communities',
              subgroup.communitySlug,
              'subgroups',
              subgroup.slug,
            ]);
            return;
          }
          this.subgroup.set(subgroup);
          this.loadPeople(subgroup);
          this.loadCommunityMembers(subgroup);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onRoleToggle(userId: string): void {
    const subgroup = this.subgroup();
    const member = this.members().find((row) => row.userId === userId);
    if (!subgroup || !member || this.mutating()) return;
    const role: SubgroupRole = member.role === 'moderator' ? 'member' : 'moderator';
    this.mutating.set(true);
    this.communityService
      .updateSubgroupRole(subgroup.communitySlug, subgroup.slug, userId, role)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refresh(subgroup),
        error: (err: ApiError) => this.fail(err),
      });
  }

  protected onRemove(userId: string): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.mutating()) return;
    if (!window.confirm(this.transloco.translate('communities.members.removeConfirm'))) return;
    this.mutating.set(true);
    this.communityService
      .removeSubgroupMember(subgroup.communitySlug, subgroup.slug, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refresh(subgroup),
        error: (err: ApiError) => this.fail(err),
      });
  }

  protected onPick(userId: string): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.mutating()) return;
    this.mutating.set(true);
    this.communityService
      .inviteToSubgroup(subgroup.communitySlug, subgroup.slug, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.query.set('');
          this.toast.success(this.transloco.translate('communities.invite.sent'));
          this.refresh(subgroup);
        },
        error: (err: ApiError) => this.fail(err),
      });
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  private refresh(subgroup: Subgroup): void {
    this.communityService
      .getSubgroup(subgroup.communitySlug, subgroup.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.subgroup.set(updated);
          this.loadPeople(updated);
        },
        error: () => {
          void this.router.navigate(['/communities', subgroup.communitySlug]);
        },
      });
  }

  private loadCommunityMembers(subgroup: Subgroup): void {
    if (!this.canManageFor(subgroup)) return;
    this.communityService
      .members(subgroup.communityId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => this.communityMembers.set(members),
        error: () => this.communityMembers.set([]),
      });
  }

  private canManageFor(subgroup: Subgroup): boolean {
    return subgroup.viewerIsCommunityAdmin || subgroup.myRole === 'moderator';
  }

  private loadPeople(subgroup: Subgroup): void {
    this.communityService
      .subgroupMembers(subgroup.communitySlug, subgroup.slug)
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
          this.fail(err);
        },
      });
  }

  private fail(err: ApiError): void {
    this.mutating.set(false);
    if (err.status >= 500 || err.status === 0 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
