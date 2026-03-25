import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CyclingEvent } from '@shared/models';
import { DisciplineChipComponent } from '../discipline-chip/discipline-chip.component';
import { EventStatusBadgeComponent } from '../event-status-badge/event-status-badge.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-event-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    DatePipe,
  ],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  readonly event = input.required<CyclingEvent>();
  readonly distance = input<number | undefined>();
}
