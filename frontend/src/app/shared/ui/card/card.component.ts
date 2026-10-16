import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Standard surface for a block of content: `<ui-card><h2>…</h2>…</ui-card>`.
 * `raised` (default) has a background and shadow; `outline` is a plain bordered box.
 */
@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `<ng-content />`,
})
export class CardComponent {
  readonly padding = input<'none' | 'sm' | 'md'>('md');
  readonly variant = input<'raised' | 'outline'>('raised');

  protected readonly classes = computed(() => {
    const padding = { none: '', sm: 'p-4', md: 'p-6' }[this.padding()];
    const surface =
      this.variant() === 'raised'
        ? 'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-card)]'
        : 'rounded-xl border border-[var(--color-border)]';
    return `block ${surface} ${padding}`;
  });
}
