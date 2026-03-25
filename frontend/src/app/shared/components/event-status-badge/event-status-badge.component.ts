import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, BadgeVariant } from '@shared/ui';
import { EventStatus } from '@shared/models';

const STATUS_MAP: Record<EventStatus, { variant: BadgeVariant; label: string }> = {
  published: { variant: 'success', label: 'Published' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  completed: { variant: 'neutral', label: 'Completed' },
};

@Component({
  selector: 'app-event-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `<ui-badge [variant]="config().variant">{{ config().label }}</ui-badge>`,
})
export class EventStatusBadgeComponent {
  readonly status = input.required<EventStatus>();

  protected readonly config = computed(() => STATUS_MAP[this.status()]);
}
