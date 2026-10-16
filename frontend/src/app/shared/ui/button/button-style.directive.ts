import { computed, Directive, input } from '@angular/core';
import { ButtonSize, ButtonVariant, buttonClasses } from './button-styles';

/**
 * Gives a link (or any element) the look of a `ui-button`:
 * `<a uiButton variant="soft" size="sm" [routerLink]="...">Edit</a>`.
 */
@Directive({
  selector: '[uiButton]',
  host: { '[class]': 'classes()' },
})
export class ButtonStyleDirective {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');

  protected readonly classes = computed(() => buttonClasses(this.variant(), this.size()));
}
