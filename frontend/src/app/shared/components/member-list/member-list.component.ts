import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BadgeComponent, ButtonComponent } from '@shared/ui';

/** Row view-model. `success` is the higher role (demote); `neutral` is the lower role (promote). */
export interface MemberListItem {
  id: string;
  name: string;
  roleLabel: string;
  roleVariant: 'success' | 'neutral';
}

@Component({
  selector: 'app-member-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, BadgeComponent, ButtonComponent],
  host: { class: 'block' },
  templateUrl: './member-list.component.html',
})
export class MemberListComponent {
  readonly items = input.required<MemberListItem[]>();
  readonly canManage = input(false);

  /** Parent decides the next role. */
  readonly roleToggle = output<string>();
  readonly remove = output<string>();
}
