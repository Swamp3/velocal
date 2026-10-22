import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ShareButtonComponent } from '@shared/components/share-button/share-button.component';
import { CommunityPoll, PollVoters } from '@shared/models';
import {
  ActionMenuComponent,
  ActionMenuItem,
  BadgeComponent,
  ButtonComponent,
  ButtonStyleDirective,
  ModalComponent,
  ToastService,
} from '@shared/ui';
import { timeLeft } from '@shared/utils/time-left';
import { communityErrorKey } from '../community-error';
import { PollEdit, PollEditDialogComponent } from '../poll-edit-dialog/poll-edit-dialog.component';

@Component({
  selector: 'app-community-poll-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    ActionMenuComponent,
    BadgeComponent,
    ButtonComponent,
    ButtonStyleDirective,
    ModalComponent,
    ShareButtonComponent,
    PollEditDialogComponent,
  ],
  templateUrl: './community-poll-detail.component.html',
})
export class CommunityPollDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly communityService = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly poll = signal<CommunityPoll | null>(null);
  protected readonly loading = signal(true);
  /** `forbidden` = members only, `missing` = no such poll (or not visible to the viewer). */
  protected readonly error = signal<'forbidden' | 'missing' | null>(null);
  protected readonly selection = signal<string[]>([]);
  protected readonly voting = signal(false);
  protected readonly editing = signal(false);
  protected readonly voters = signal<PollVoters | null>(null);
  protected readonly showVoters = signal(false);
  protected readonly loadingVoters = signal(false);
  protected readonly savingEdit = signal(false);
  protected readonly loggedIn = this.auth.isAuthenticated;

  private communitySlug = '';
  private subgroupSlug: string | null = null;

  /** Link to the poll list of the club or subgroup the poll belongs to. */
  protected readonly listLink = computed(() => {
    const subgroup = this.subgroupSlug;
    return subgroup
      ? ['/communities', this.communitySlug, 'subgroups', subgroup, 'polls']
      : ['/communities', this.communitySlug, 'polls'];
  });

  protected readonly hostLink = computed(() => {
    const subgroup = this.subgroupSlug;
    return subgroup
      ? ['/communities', this.communitySlug, 'subgroups', subgroup]
      : ['/communities', this.communitySlug];
  });

  protected readonly sharePath = computed(() => {
    const subgroup = this.subgroupSlug;
    const id = this.poll()?.id ?? '';
    return subgroup
      ? `/communities/${this.communitySlug}/subgroups/${subgroup}/polls/${id}`
      : `/communities/${this.communitySlug}/polls/${id}`;
  });

  protected readonly menuItems = computed<ActionMenuItem[]>(() => {
    const poll = this.poll();
    if (!poll) return [];
    const items: ActionMenuItem[] = [];
    if (poll.canEdit) {
      items.push({ id: 'edit', label: this.transloco.translate('communities.posts.edit'), icon: 'edit' });
    }
    if (poll.canDelete) {
      items.push({
        id: 'delete',
        label: this.transloco.translate('communities.polls.delete'),
        icon: 'delete',
        danger: true,
      });
    }
    return items;
  });

  /** Highest vote count, so the leading option(s) can be highlighted once there are votes. */
  protected readonly topVotes = computed(() => {
    const poll = this.poll();
    if (!poll?.canSeeResults) return 0;
    return Math.max(0, ...poll.options.map((option) => option.votes ?? 0));
  });

  protected readonly hasVoted = computed(() => this.poll()?.options.some((o) => o.selected) ?? false);

  protected readonly remaining = computed(() => {
    const poll = this.poll();
    const left = poll?.closesAt && !poll.closed ? timeLeft(poll.closesAt) : null;
    if (!left) return null;
    const key = `communities.polls.endsIn.${left.unit}${left.value === 1 ? 'One' : 'Many'}`;
    return this.transloco.translate(key, { count: left.value });
  });

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.communitySlug = params.get('slug') ?? '';
    this.subgroupSlug = params.get('subgroupSlug');
    const pollId = params.get('pollId') ?? '';
    this.seo.setMeta({ title: this.transloco.translate('communities.polls.title'), description: '', noindex: true });

    this.communityService
      .getPoll(this.communitySlug, pollId, this.subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (poll) => {
          this.setPoll(poll);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err.status === 403 || err.status === 401 ? 'forbidden' : 'missing');
          this.loading.set(false);
        },
      });
  }

  protected toggle(optionId: string): void {
    const poll = this.poll();
    if (!poll?.canVote) return;
    this.selection.update((current) =>
      poll.multiple
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId],
    );
  }

  protected vote(): void {
    const poll = this.poll();
    const optionIds = this.selection();
    if (!poll || optionIds.length === 0 || this.voting()) return;
    this.voting.set(true);
    this.communityService
      .votePoll(this.communitySlug, poll.id, optionIds, this.subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          // The vote response carries no author name or host details; keep what the page has.
          this.setPoll({ ...poll, ...updated });
          this.voting.set(false);
          this.toast.success(this.transloco.translate('communities.polls.voted'));
        },
        error: (err: ApiError) => {
          this.voting.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected openVoters(): void {
    const poll = this.poll();
    if (!poll || this.loadingVoters()) return;
    this.showVoters.set(true);
    this.loadingVoters.set(true);
    this.communityService
      .getPollVoters(this.communitySlug, poll.id, this.subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (voters) => {
          this.voters.set(voters);
          this.loadingVoters.set(false);
        },
        error: (err: ApiError) => {
          this.loadingVoters.set(false);
          this.showVoters.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected onMenu(id: string): void {
    if (id === 'edit') this.editing.set(true);
    if (id === 'delete') this.remove();
  }

  protected saveEdit(edit: PollEdit): void {
    const poll = this.poll();
    if (!poll || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.communityService
      .updatePoll(this.communitySlug, poll.id, edit, this.subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.setPoll(updated);
          this.savingEdit.set(false);
          this.editing.set(false);
          this.toast.success(this.transloco.translate('communities.polls.updated'));
        },
        error: (err: ApiError) => {
          this.savingEdit.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  private remove(): void {
    const poll = this.poll();
    if (!poll || !window.confirm(this.transloco.translate('communities.polls.deleteConfirm'))) return;
    this.communityService
      .deletePoll(this.communitySlug, poll.id, this.subgroupSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(this.listLink()),
        error: (err: ApiError) => {
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  private setPoll(poll: CommunityPoll): void {
    this.poll.set(poll);
    this.selection.set(poll.options.filter((option) => option.selected).map((option) => option.id));
    this.seo.setMeta({ title: poll.question, description: '', noindex: true });
  }
}
