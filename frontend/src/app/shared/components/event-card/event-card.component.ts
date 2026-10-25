import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CyclingEvent } from '@shared/models';
import { RacingService } from '@core/services/racing.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { eventStartTime } from '@shared/utils/event-date';
import { DisciplineChipComponent } from '../discipline-chip/discipline-chip.component';
import { EventStatusBadgeComponent } from '../event-status-badge/event-status-badge.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-event-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'min-w-0' },
  imports: [
    TranslocoPipe,
    RouterLink,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    DatePipe,
  ],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  private readonly racing = inject(RacingService);
  readonly event = input.required<CyclingEvent>();

  /** Touring events (RTF, CTF …) list routes instead of rating classes. */
  protected readonly touring = computed(() => this.racing.isTouring(this.event().format));
  readonly distance = input<number | undefined>();
  protected readonly startTime = computed(() => eventStartTime(this.event()));
  protected readonly hasClassChampionship = computed(
    () => this.event().classes?.some((c) => !!c.championship) ?? false,
  );
}
