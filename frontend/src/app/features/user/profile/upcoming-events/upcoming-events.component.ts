import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MyUpcomingEvent, UserService } from '@core/services/user.service';
import { formatTime } from '@shared/utils/event-date';
import { BadgeComponent, SkeletonComponent } from '@shared/ui';

/** Profile overview: the events the user signed up for and that are still ahead. */
@Component({
  selector: 'app-upcoming-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslocoPipe, BadgeComponent, SkeletonComponent],
  templateUrl: './upcoming-events.component.html',
})
export class UpcomingEventsComponent implements OnInit {
  private readonly users = inject(UserService);

  protected readonly events = signal<MyUpcomingEvent[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly time = formatTime;

  ngOnInit(): void {
    this.users.getUpcomingEvents().subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Club events open with their club, so the page knows which RSVP to show. */
  protected query(event: MyUpcomingEvent): Record<string, string> {
    if (!event.community) return {};
    return event.subgroup
      ? { community: event.community.slug, subgroup: event.subgroup.slug }
      : { community: event.community.slug };
  }
}
