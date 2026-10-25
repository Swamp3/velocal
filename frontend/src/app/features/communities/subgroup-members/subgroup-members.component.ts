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
  ConfirmDialogComponent,
  EmptyStateComponent,
  InviteByEmailComponent,
  MemberFiltersComponent,
  MemberListComponent,
  MemberListItem,
} from '@shared/components';
import { Subgroup, SubgroupMember, SubgroupRole } from '@shared/models';
import {
  ButtonStyleDirective,
  PaginationComponent,
  SegmentedOption,
  SkeletonComponent,
  ToastService,
} from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-subgroup-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    RouterLink,
    TranslocoPipe,
    SkeletonComponent,
    EmptyStateComponent,
    MemberListComponent,
    MemberFiltersComponent,
    PaginationComponent,
    ButtonStyleDirective,
    InviteByEmailComponent,
  ],
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
  protected readonly promoteCandidate = signal<SubgroupMember | null>(null);
  protected readonly query = signal('');
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = 30;
  protected readonly role = signal<string>('all');
  /** True while a filter or page change is loading; the list stays on screen meanwhile. */
  protected readonly listLoading = signal(false);
  protected readonly roleOptions: SegmentedOption<string>[] = [
    { value: 'all', labelKey: 'communities.members.filterAll' },
    { value: 'moderator', labelKey: 'communities.members.filterModerators' },
    { value: 'member', labelKey: 'communities.members.filterMembers' },
  ];
  protected readonly filtered = computed(
    () => this.filterText() !== '' || this.role() !== 'all',
  );
  private readonly filterText = signal('');

  /** Club members who are not in the subgroup yet, found by the server for the typed text. */
  protected readonly suggestions = signal<{ userId: string; name: string }[]>([]);
  private suggestTimer: ReturnType<typeof setTimeout> | undefined;

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
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onFilterSearch(text: string): void {
    this.filterText.set(text);
    this.page.set(1);
    this.reloadPeople();
  }

  protected onRoleFilter(role: string): void {
    this.role.set(role);
    this.page.set(1);
    this.reloadPeople();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.reloadPeople();
  }

  private reloadPeople(): void {
    const subgroup = this.subgroup();
    if (subgroup) this.loadPeople(subgroup);
  }

  protected onRoleToggle(userId: string): void {
    const member = this.members().find((row) => row.userId === userId);
    if (!member || this.mutating()) return;
    // Moderator rights are powerful, so ask before granting them.
    if (member.role === 'moderator') this.changeRole(userId, 'member');
    else this.promoteCandidate.set(member);
  }

  protected confirmPromote(): void {
    const member = this.promoteCandidate();
    if (!member) return;
    this.promoteCandidate.set(null);
    this.changeRole(member.userId, 'moderator');
  }

  private changeRole(userId: string, role: SubgroupRole): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.mutating()) return;
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
      .inviteToSubgroup(subgroup.communitySlug, subgroup.slug, { userId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.query.set('');
          this.suggestions.set([]);
          this.toast.success(this.transloco.translate('communities.invite.sent'));
          this.refresh(subgroup);
        },
        error: (err: ApiError) => this.fail(err),
      });
  }

  protected onInviteEmail(email: string): void {
    const subgroup = this.subgroup();
    if (!subgroup || this.mutating()) return;
    this.mutating.set(true);
    this.communityService
      .inviteToSubgroup(subgroup.communitySlug, subgroup.slug, { email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.query.set('');
          this.suggestions.set([]);
          this.toast.success(this.transloco.translate('communities.invite.sent'));
          this.refresh(subgroup);
        },
        error: (err: ApiError) => this.fail(err),
      });
  }

  protected onQuery(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.query.set(text);
    clearTimeout(this.suggestTimer);
    const subgroup = this.subgroup();
    if (!text.trim() || !subgroup) {
      this.suggestions.set([]);
      return;
    }
    this.suggestTimer = setTimeout(() => this.loadSuggestions(subgroup, text.trim()), 250);
  }

  private loadSuggestions(subgroup: Subgroup, text: string): void {
    const unnamed = this.transloco.translate('communities.members.unnamed');
    this.communityService
      .members(subgroup.communityId, { q: text, limit: 8, excludeSubgroup: subgroup.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Ignore an answer for text that is no longer in the box.
        next: (result) => {
          if (this.query().trim() !== text) return;
          this.suggestions.set(
            result.items.map((member) => ({
              userId: member.userId,
              name: member.displayName ?? unnamed,
            })),
          );
        },
        error: () => this.suggestions.set([]),
      });
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

  private loadPeople(subgroup: Subgroup): void {
    this.listLoading.set(true);
    this.communityService
      .subgroupMembers(subgroup.communitySlug, subgroup.slug, {
        q: this.filterText(),
        role: this.role() as 'all' | 'moderator' | 'member',
        page: this.page(),
        limit: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          // The last row of a page was removed: show the page before it.
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, Math.ceil(result.total / this.pageSize)));
            this.loadPeople(subgroup);
            return;
          }
          this.members.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
          this.listLoading.set(false);
          this.mutating.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.listLoading.set(false);
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
