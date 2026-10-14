import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityPoll, PollResultsVisibility } from '@shared/models';
import { ButtonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-polls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe, ButtonComponent],
  templateUrl: './community-polls.component.html',
})
export class CommunityPollsComponent implements OnInit {
  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string | null>(null);

  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly polls = signal<CommunityPoll[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly votingId = signal<string | null>(null);
  protected readonly question = signal('');
  protected readonly options = signal(['', '']);
  protected readonly multiple = signal(false);
  protected readonly resultsVisibility = signal<PollResultsVisibility>('members');
  protected readonly closesAt = signal('');
  protected readonly selection = signal<Record<string, string[]>>({});

  ngOnInit(): void {
    this.communityService
      .listPolls(this.communitySlug(), this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (polls) => {
          this.polls.set(polls);
          this.selection.set(this.selectionFrom(polls));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected addOption(): void {
    this.options.update((options) => (options.length >= 12 ? options : [...options, '']));
  }

  protected setOption(index: number, value: string): void {
    this.options.update((options) => options.map((option, i) => (i === index ? value : option)));
  }

  protected chosen(pollId: string, optionId: string): boolean {
    return this.selection()[pollId]?.includes(optionId) ?? false;
  }

  protected toggle(poll: CommunityPoll, optionId: string): void {
    if (poll.closed) return;
    this.selection.update((current) => {
      const existing = current[poll.id] ?? [];
      const next = poll.multiple
        ? existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId]
        : [optionId];
      return { ...current, [poll.id]: next };
    });
  }

  protected create(): void {
    const question = this.question().trim();
    const options = this.options()
      .map((option) => option.trim())
      .filter(Boolean);
    if (!question || options.length < 2 || this.creating()) return;
    this.creating.set(true);
    const closesAt = this.closesAt();
    this.communityService
      .createPoll(
        this.communitySlug(),
        {
          question,
          multiple: this.multiple(),
          resultsVisibility: this.resultsVisibility(),
          closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
          options: options.map((label) => ({ label })),
        },
        this.subgroupSlug(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (poll) => {
          this.polls.update((polls) => [poll, ...polls]);
          this.selection.update((current) => ({ ...current, [poll.id]: [] }));
          this.question.set('');
          this.options.set(['', '']);
          this.multiple.set(false);
          this.closesAt.set('');
          this.creating.set(false);
        },
        error: (err: ApiError) => {
          this.creating.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected vote(poll: CommunityPoll): void {
    const optionIds = this.selection()[poll.id] ?? [];
    if (optionIds.length === 0 || this.votingId()) return;
    this.votingId.set(poll.id);
    this.communityService
      .votePoll(this.communitySlug(), poll.id, optionIds, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.polls.update((polls) => polls.map((row) => (row.id === updated.id ? updated : row)));
          this.selection.update((current) => ({
            ...current,
            [updated.id]: updated.options
              .filter((option) => option.selected)
              .map((option) => option.id),
          }));
          this.votingId.set(null);
          this.toast.success(this.transloco.translate('communities.polls.voted'));
        },
        error: (err: ApiError) => {
          this.votingId.set(null);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  protected remove(poll: CommunityPoll): void {
    if (!window.confirm(this.transloco.translate('communities.polls.deleteConfirm'))) return;
    this.communityService
      .deletePoll(this.communitySlug(), poll.id, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.polls.update((polls) => polls.filter((row) => row.id !== poll.id)),
        error: (err: ApiError) => {
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }

  private selectionFrom(polls: CommunityPoll[]): Record<string, string[]> {
    return Object.fromEntries(
      polls.map((poll) => [
        poll.id,
        poll.options.filter((option) => option.selected).map((option) => option.id),
      ]),
    );
  }
}
