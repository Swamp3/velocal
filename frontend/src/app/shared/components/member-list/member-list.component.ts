import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BadgeComponent, ButtonComponent } from '@shared/ui';

/** Row view-model. Action labels are already translated by the parent. */
export interface MemberListItem {
  id: string;
  name: string;
  /** Link to the member's Strava profile, if they shared one. */
  stravaUrl?: string | null;
  roleLabel: string;
  roleVariant: 'success' | 'warning' | 'neutral';
  toggleLabel?: string;
  canRemove?: boolean;
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

  /** Parent decides the next role. */
  readonly roleToggle = output<string>();
  readonly remove = output<string>();
}
