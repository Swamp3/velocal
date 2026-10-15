import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, ModalComponent } from '@shared/ui';

/**
 * Confirmation for destructive deletes. The user has to type `confirmText`
 * (usually the item's name) before the delete button turns on.
 */
@Component({
  selector: 'app-confirm-delete-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe, ModalComponent, ButtonComponent],
  template: `
    <ui-modal [title]="title()" (closed)="cancelled.emit()">
      <p class="text-sm text-[var(--color-text)]">{{ message() }}</p>
      <label for="confirm-delete-input" class="mt-4 block text-sm text-[var(--color-text-muted)]">
        {{ 'common.typeToConfirm' | transloco: { text: confirmText() } }}
      </label>
      <input
        id="confirm-delete-input"
        type="text"
        autocomplete="off"
        [ngModel]="typed()"
        (ngModelChange)="typed.set($event)"
        class="mt-1.5 w-full rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-primary)]"
      />
      <ng-container footer>
        <ui-button type="button" variant="ghost" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </ui-button>
        <ui-button
          type="button"
          variant="danger"
          [loading]="busy()"
          [disabled]="busy() || !matches()"
          (click)="confirmed.emit()"
        >
          {{ confirmLabel() }}
        </ui-button>
      </ng-container>
    </ui-modal>
  `,
})
export class ConfirmDeleteDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmText = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly typed = signal('');
  protected readonly matches = computed(
    () => this.typed().trim().toLowerCase() === this.confirmText().trim().toLowerCase(),
  );
}
