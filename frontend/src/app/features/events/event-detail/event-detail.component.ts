import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-event-detail',
  template: `<p class="p-4 text-lg">Event detail — coming soon</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailComponent {}
