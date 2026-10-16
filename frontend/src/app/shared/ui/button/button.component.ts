import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ButtonSize, ButtonVariant, buttonClasses } from './button-styles';

export type { ButtonSize, ButtonVariant } from './button-styles';

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

  protected readonly classes = computed(() => buttonClasses(this.variant(), this.size()));
}
