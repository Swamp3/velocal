import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ActionMenuComponent, type ActionMenuItem, BadgeComponent } from '@shared/ui';

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
  imports: [TranslocoPipe, BadgeComponent, ActionMenuComponent],
  host: { class: 'block' },
  templateUrl: './member-list.component.html',
})
export class MemberListComponent {
  private readonly transloco = inject(TranslocoService);

  readonly items = input.required<MemberListItem[]>();

  /** Parent decides the next role. */
  readonly roleToggle = output<string>();
  readonly remove = output<string>();

  /** Role change and removal sit in one "more" menu per row, so every row is one line high. */
  protected menuItems(item: MemberListItem): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    if (item.toggleLabel) {
      items.push({ id: 'role', label: item.toggleLabel, icon: 'admin_panel_settings' });
    }
    if (item.canRemove) {
      items.push({
        id: 'remove',
        label: this.transloco.translate('communities.members.remove'),
        icon: 'group_off',
        danger: true,
      });
    }
    return items;
  }

  protected onAction(id: string, item: MemberListItem): void {
    if (id === 'role') this.roleToggle.emit(item.id);
    else if (id === 'remove') this.remove.emit(item.id);
  }
}
