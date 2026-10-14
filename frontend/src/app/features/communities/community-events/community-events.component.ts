import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CommunityService } from '@core/services/community.service';
import { CyclingEvent } from '@shared/models';

@Component({
  selector: 'app-community-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, DatePipe],
  templateUrl: './community-events.component.html',
})
export class CommunityEventsComponent implements OnInit {
  private readonly communities = inject(CommunityService);

  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string>();
  readonly canCreate = input(false);

  protected readonly events = signal<CyclingEvent[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.communities.listEvents(this.communitySlug(), this.subgroupSlug()).subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected createLink(): string[] {
    const subgroup = this.subgroupSlug();
    return subgroup
      ? ['/communities', this.communitySlug(), 'subgroups', subgroup, 'events', 'new']
      : ['/communities', this.communitySlug(), 'events', 'new'];
  }

  protected readonly outlineLinkClass =
    'inline-flex items-center justify-center rounded-[var(--radius-default)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';
}
