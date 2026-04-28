import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly form = input<string>();

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-[var(--radius-default)] ' +
      'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
      'focus-visible:outline-[var(--color-primary)] disabled:opacity-50 disabled:pointer-events-none ' +
      'cursor-pointer';

    const sizeMap: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    const variantMap: Record<ButtonVariant, string> = {
      primary:
        'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] ' +
        'active:bg-[var(--color-primary-dark)]',
      secondary:
        'bg-[var(--color-secondary)] text-white hover:opacity-90 active:opacity-80',
      outline:
        'border border-[var(--color-border)] text-[var(--color-text)] ' +
        'hover:bg-[var(--color-bg-alt)] active:bg-[var(--color-border)]',
      ghost:
        'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] ' +
        'hover:text-[var(--color-text)] active:bg-[var(--color-border)]',
      danger:
        'bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-80',
    };

    return `${base} ${sizeMap[this.size()]} ${variantMap[this.variant()]}`;
  });
}
