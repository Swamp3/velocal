import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export interface SegmentedOption<T extends string | number = string> {
  value: T;
  /** Translation key shown as the label. */
  labelKey: string;
  /** Small number next to the label, e.g. an open count. Hidden when 0 or unset. */
  count?: number;
}

/**
 * One-of-many switch for filters and views (tabs, status filters, periods):
 * `<ui-segmented [options]="options" [value]="current()" (valueChange)="set($event)" />`.
 */
@Component({
  selector: 'ui-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'max-w-full' },
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      class="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] p-0.5"
    >
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="option.value === value()"
          [class]="itemClasses(option.value === value())"
          (click)="valueChange.emit(option.value)"
        >
          {{ option.labelKey | transloco }}
          @if (option.count) {
            <span class="ml-1 rounded-full bg-black/10 px-1.5 text-xs tabular-nums">{{
              option.count
            }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent<T extends string | number = string> {
  readonly options = input.required<SegmentedOption<T>[]>();
  readonly value = input.required<T>();
  readonly size = input<'sm' | 'md'>('sm');
  readonly ariaLabel = input<string>();
  readonly valueChange = output<T>();

  private readonly sizeClasses = computed(() =>
    this.size() === 'md' ? 'px-3 py-1.5 text-sm' : 'px-3 py-1.5 text-xs',
  );

  protected itemClasses(selected: boolean): string {
    return (
      `shrink-0 cursor-pointer rounded-md font-medium transition-all ${this.sizeClasses()} ` +
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ' +
      (selected
        ? 'bg-[var(--color-primary)] text-white shadow-sm'
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]')
    );
  }
}
