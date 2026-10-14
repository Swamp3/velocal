import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent } from '@shared/ui';

export interface RequestListItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-request-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ButtonComponent],
  host: { class: 'block' },
  templateUrl: './request-list.component.html',
})
export class RequestListComponent {
  readonly items = input.required<RequestListItem[]>();

  readonly approve = output<string>();
  readonly reject = output<string>();
}
