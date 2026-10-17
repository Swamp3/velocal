import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, ModalComponent } from '@shared/ui';

/** Plain confirmation for actions that are easy to trigger by accident but are not deletes. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ModalComponent, ButtonComponent],
  template: `
    <ui-modal [title]="title()" (closed)="cancelled.emit()">
      <p class="text-sm text-[var(--color-text)]">{{ message() }}</p>
      <ng-container footer>
        <ui-button type="button" variant="ghost" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </ui-button>
        <ui-button type="button" [loading]="busy()" [disabled]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </ui-button>
      </ng-container>
    </ui-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
