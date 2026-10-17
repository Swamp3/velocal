import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { IconButtonComponent } from '@shared/ui/icon-button/icon-button.component';

/**
 * Top bar of a form page: way back on the left, cancel (x) and save on the right. The save button
 * submits the form with the given id, so the form itself can sit anywhere below. The bar stays
 * visible while a long form scrolls. Extra actions (for example "Save as draft") go into the
 * content slot and appear left of the cancel button.
 */
@Component({
  selector: 'app-form-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, ButtonComponent, IconButtonComponent],
  host: { class: 'sticky top-16 z-20 block' },
  template: `
    <div
      class="-mx-4 flex items-center justify-between gap-3 bg-[var(--color-bg)]/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
    >
      @if (backLabel()) {
        <a
          [routerLink]="backLink()"
          [queryParams]="backQuery()"
          class="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
          <span class="truncate">{{ backLabel() }}</span>
        </a>
      } @else {
        <h1 class="truncate text-2xl font-bold text-[var(--color-text)]">{{ title() }}</h1>
      }
      <div class="flex shrink-0 items-center gap-1.5">
        <ng-content />
        @if (backLabel()) {
          <a
            uiIconButton
            icon="close"
            variant="ghost"
            [routerLink]="cancelLink().length ? cancelLink() : backLink()"
            [queryParams]="backQuery()"
            [label]="'common.cancel' | transloco"
          ></a>
        }
        <ui-button
          type="submit"
          [form]="formId()"
          [loading]="saving()"
          [disabled]="saving() || disabled()"
        >
          {{ saveLabel() || ('common.save' | transloco) }}
        </ui-button>
      </div>
    </div>
  `,
})
export class FormActionsComponent {
  readonly formId = input.required<string>();
  /** Text of the back link; without it the bar shows `title` instead and no cancel button. */
  readonly backLabel = input('');
  readonly backLink = input<string[]>([]);
  readonly backQuery = input<Record<string, string>>({});
  readonly cancelLink = input<string[]>([]);
  readonly title = input('');
  readonly saveLabel = input('');
  readonly saving = input(false);
  readonly disabled = input(false);
}
