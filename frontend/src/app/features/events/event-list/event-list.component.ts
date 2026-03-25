import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-event-list',
  template: `<p class="p-4 text-lg">Events — coming soon</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventListComponent {}
