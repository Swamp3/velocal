import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconButtonVariant = 'ghost' | 'outline' | 'soft' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<IconButtonSize, { box: string; icon: string }> = {
  sm: { box: 'size-8', icon: 'text-[18px]' },
  md: { box: 'size-9', icon: 'text-[20px]' },
  lg: { box: 'size-10', icon: 'text-[22px]' },
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]',
  outline:
    'border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] ' +
    'hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]',
  soft: 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10',
  danger: 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10',
};

/**
 * Round button with only an icon. `label` is the accessible name and is
 * required, because there is no visible text:
 * `<button uiIconButton icon="close" label="Close" (click)="...">`.
 */
@Component({
  selector: 'button[uiIconButton], a[uiIconButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
  },
  template: `<span class="material-symbols-outlined" [class]="iconSize()" aria-hidden="true">{{
    icon()
  }}</span>`,
})
export class IconButtonComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly variant = input<IconButtonVariant>('ghost');
  readonly size = input<IconButtonSize>('md');
  readonly shape = input<'round' | 'square'>('round');

  protected readonly iconSize = computed(() => SIZES[this.size()].icon);
  protected readonly classes = computed(
    () =>
      `inline-flex ${SIZES[this.size()].box} shrink-0 items-center justify-center ` +
      `${this.shape() === 'round' ? 'rounded-full' : 'rounded-lg'} transition-colors ` +
      'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ' +
      'focus-visible:outline-[var(--color-primary)] disabled:opacity-50 disabled:pointer-events-none ' +
      VARIANTS[this.variant()],
  );
}
