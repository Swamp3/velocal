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
import { Community, CommunityMember, CommunityRole } from '@shared/models';
import { communityErrorKey } from '../community-error';
import {
  ButtonStyleDirective,
  PaginationComponent,
  SegmentedOption,
  SkeletonComponent,
  ToastService,
} from '@shared/ui';

@Component({
  selector: 'app-community-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    RouterLink,
    TranslocoPipe,
    SkeletonComponent,
    EmptyStateComponent,
    InviteByEmailComponent,
    MemberListComponent,
    MemberFiltersComponent,
    PaginationComponent,
    ButtonStyleDirective,
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
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = 30;
  protected readonly query = signal('');
  protected readonly role = signal<string>('all');
  /** True while a filter or page change is loading; the list stays on screen meanwhile. */
  protected readonly listLoading = signal(false);
  protected readonly roleOptions: SegmentedOption<string>[] = [
    { value: 'all', labelKey: 'communities.members.filterAll' },
    { value: 'admin', labelKey: 'communities.members.filterAdmins' },
    { value: 'member', labelKey: 'communities.members.filterMembers' },
  ];
  protected readonly filtered = computed(() => this.query() !== '' || this.role() !== 'all');

  protected readonly promoteCandidate = signal<CommunityMember | null>(null);
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

  protected onSearch(text: string): void {
    this.query.set(text);
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
    const community = this.community();
    if (community) this.loadPeople(community);
  }

  protected onRoleToggle(userId: string): void {
    const member = this.members().find((row) => row.userId === userId);
    if (!member || this.mutating()) return;
    // Giving someone admin rights is hard to undo in practice, so ask first.
    if (member.role === 'admin') this.changeRole(userId, 'member');
    else this.promoteCandidate.set(member);
  }

  protected confirmPromote(): void {
    const member = this.promoteCandidate();
    if (!member) return;
    this.promoteCandidate.set(null);
    this.changeRole(member.userId, 'admin');
  }

  private changeRole(userId: string, role: CommunityRole): void {
    const community = this.community();
    if (!community || this.mutating()) return;
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
    this.listLoading.set(true);
    this.communityService
      .members(community.id, {
        q: this.query(),
        role: this.role() as 'all' | 'admin' | 'member',
        page: this.page(),
        limit: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          // The last row of a page was removed: show the page before it.
          if (result.items.length === 0 && this.page() > 1) {
            this.page.set(Math.max(1, Math.ceil(result.total / this.pageSize)));
            this.loadPeople(community);
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
          this.toastMembershipError(err);
        },
      });
  }

  private toastMembershipError(err: ApiError): void {
    if (err.status >= 500 || err.status === 0 || err.status === 408) return;
    this.toast.error(this.transloco.translate(communityErrorKey(err)));
  }
}
