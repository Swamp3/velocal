import { ChangeDetectionStrategy, Component, input } from '@angular/core';
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  readonly icon = input('');
  readonly title = input('');
  readonly message = input('');
}
