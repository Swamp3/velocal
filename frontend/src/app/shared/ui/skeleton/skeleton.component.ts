import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[class]': '"block animate-pulse bg-[var(--color-border)]" + " " + roundedClass()',
  },
  template: '',
})
export class SkeletonComponent {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly rounded = input<'sm' | 'default' | 'lg' | 'full'>('default');

  protected roundedClass(): string {
    const map = {
      sm: 'rounded-sm',
      default: 'rounded-[var(--radius-default)]',
      lg: 'rounded-[var(--radius-lg)]',
      full: 'rounded-full',
    };
    return map[this.rounded()];
  }
}
