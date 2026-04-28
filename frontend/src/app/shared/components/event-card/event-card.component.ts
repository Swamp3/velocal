import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CyclingEvent } from '@shared/models';
import { formatTime } from '@shared/utils/event-date';
import { AddToCalendarComponent } from '../add-to-calendar/add-to-calendar.component';
import { DisciplineChipComponent } from '../discipline-chip/discipline-chip.component';
import { EventStatusBadgeComponent } from '../event-status-badge/event-status-badge.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-event-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'min-w-0' },
  imports: [
    RouterLink,
    AddToCalendarComponent,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    DatePipe,
  ],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  readonly event = input.required<CyclingEvent>();
  readonly distance = input<number | undefined>();
  protected readonly startTime = computed(() => formatTime(this.event().startDate));
}
