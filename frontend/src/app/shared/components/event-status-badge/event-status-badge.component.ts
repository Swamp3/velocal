import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { BadgeComponent, BadgeVariant } from '@shared/ui';
import { EventStatus } from '@shared/models';

const STATUS_VARIANT: Record<EventStatus, BadgeVariant> = {
  published: 'success',
  cancelled: 'danger',
  completed: 'neutral',
};

const STATUS_KEY: Record<EventStatus, string> = {
  published: 'events.status.published',
  cancelled: 'events.status.cancelled',
  completed: 'events.status.completed',
};

@Component({
  selector: 'app-event-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `<ui-badge [variant]="variant()">{{ label() }}</ui-badge>`,
})
export class EventStatusBadgeComponent {
  readonly status = input.required<EventStatus>();

  private readonly transloco = inject(TranslocoService);

  protected readonly variant = computed(() => STATUS_VARIANT[this.status()]);
  protected readonly label = computed(() =>
    this.transloco.translate(STATUS_KEY[this.status()]),
  );
}
