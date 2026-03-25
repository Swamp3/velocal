import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'success' | 'danger' | 'neutral' | 'warning';

@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()"><ng-content /></span>`,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

    const variantMap: Record<BadgeVariant, string> = {
      success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    };

    return `${base} ${variantMap[this.variant()]}`;
  });
}
