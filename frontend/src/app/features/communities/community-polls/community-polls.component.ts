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
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityPoll } from '@shared/models';
import { ButtonComponent, ButtonStyleDirective, ToastService } from '@shared/ui';
import { PollEdit, PollEditDialogComponent } from '../poll-edit-dialog/poll-edit-dialog.component';
import { communityErrorKey } from '../community-error';

@Component({
  selector: 'app-community-polls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ButtonComponent, PollEditDialogComponent, ButtonStyleDirective],
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
  protected readonly votingId = signal<string | null>(null);
  protected readonly editing = signal<CommunityPoll | null>(null);
  protected readonly savingEdit = signal(false);
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

  protected saveEdit(edit: PollEdit): void {
    const poll = this.editing();
    if (!poll || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.communityService
      .updatePoll(this.communitySlug(), poll.id, edit, this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.polls.update((polls) => polls.map((row) => (row.id === updated.id ? updated : row)));
          // Choices on removed options are gone; keep the rest of the user's selection.
          this.selection.update((current) => ({
            ...current,
            [updated.id]: (current[updated.id] ?? []).filter((id) =>
              updated.options.some((option) => option.id === id),
            ),
          }));
          this.savingEdit.set(false);
          this.editing.set(null);
          this.toast.success(this.transloco.translate('communities.polls.updated'));
        },
        error: (err: ApiError) => {
          this.savingEdit.set(false);
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
