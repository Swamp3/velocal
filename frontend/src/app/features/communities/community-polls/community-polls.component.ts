import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityPoll } from '@shared/models';
import { BadgeComponent } from '@shared/ui';
import { timeLeft } from '@shared/utils/time-left';

/** Overview of the polls of a club or subgroup. Voting and results live on the detail page. */
@Component({
  selector: 'app-community-polls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DatePipe, RouterLink, BadgeComponent],
  templateUrl: './community-polls.component.html',
})
export class CommunityPollsComponent implements OnInit {
  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string | null>(null);

  private readonly communityService = inject(CommunityService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly polls = signal<CommunityPoll[]>([]);
  protected readonly loading = signal(true);

  protected detailLink(poll: CommunityPoll): string[] {
    const subgroup = this.subgroupSlug();
    return subgroup
      ? ['/communities', this.communitySlug(), 'subgroups', subgroup, 'polls', poll.id]
      : ['/communities', this.communitySlug(), 'polls', poll.id];
  }

  protected hasVoted(poll: CommunityPoll): boolean {
    return poll.options.some((option) => option.selected);
  }

  /** "Ends in 2 days" for a poll that is still open. */
  protected remaining(poll: CommunityPoll): string {
    const left = poll.closesAt ? timeLeft(poll.closesAt) : null;
    if (!left) return this.transloco.translate('communities.polls.closed');
    const key = `communities.polls.endsIn.${left.unit}${left.value === 1 ? 'One' : 'Many'}`;
    return this.transloco.translate(key, { count: left.value });
  }

  ngOnInit(): void {
    this.communityService
      .listPolls(this.communitySlug(), this.subgroupSlug())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (polls) => {
          this.polls.set(polls);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
