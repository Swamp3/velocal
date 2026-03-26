import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ui-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '(click)': 'toggle()',
    '(keydown.enter)': 'toggle()',
    '(keydown.space)': '$event.preventDefault(); toggle()',
    role: 'option',
    '[attr.aria-selected]': 'selected()',
    tabindex: '0',
  },
  templateUrl: './chip.component.html',
})
export class ChipComponent {
  readonly selected = input(false);
  readonly icon = input('');
  readonly selectedChange = output<boolean>();

  protected readonly classes = computed(() => {
    const base =
      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm ' +
      'font-medium cursor-pointer select-none transition-all duration-200 ' +
      'focus-visible:outline-2 focus-visible:outline-offset-2 ' +
      'focus-visible:outline-[var(--color-primary)]';

    return this.selected()
      ? `${base} bg-[var(--color-primary)] text-white shadow-[var(--shadow-glow)]`
      : `${base} bg-[var(--color-bg-card)] text-[var(--color-text-muted)] ` +
          'border border-[var(--color-border)] hover:border-[var(--color-primary)] ' +
          'hover:text-[var(--color-primary)] hover:shadow-sm';
  });

  protected toggle(): void {
    this.selectedChange.emit(!this.selected());
  }
}
