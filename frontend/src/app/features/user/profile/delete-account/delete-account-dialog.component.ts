import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { ButtonComponent, ModalComponent, ToastService } from '@shared/ui';

const INPUT_CLASS =
  'mt-1.5 w-full rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-primary)]';

/** Asks for the email (and password) and deletes the signed-in user's account. */
@Component({
  selector: 'app-delete-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe, ModalComponent, ButtonComponent],
  template: `
    <ui-modal [title]="'profile.delete.title' | transloco" (closed)="cancelled.emit()">
      <p class="text-sm text-[var(--color-text)]">{{ 'profile.delete.intro' | transloco }}</p>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
        <li>{{ 'profile.delete.lossProfile' | transloco }}</li>
        <li>{{ 'profile.delete.lossCommunities' | transloco }}</li>
        <li>{{ 'profile.delete.lossAdmin' | transloco }}</li>
      </ul>

      <label class="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          class="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-primary)]"
          [ngModel]="deleteContent()"
          (ngModelChange)="deleteContent.set($event)"
        />
        <span class="text-sm text-[var(--color-text)]">
          {{ 'profile.delete.content' | transloco }}
          <span class="block text-xs text-[var(--color-text-muted)]">
            {{ 'profile.delete.contentHint' | transloco }}
          </span>
        </span>
      </label>

      @if (hasPassword()) {
        <label
          for="delete-account-password"
          class="mt-4 block text-sm text-[var(--color-text-muted)]"
        >
          {{ 'profile.delete.password' | transloco }}
        </label>
        <input
          id="delete-account-password"
          type="password"
          autocomplete="current-password"
          [ngModel]="password()"
          (ngModelChange)="password.set($event)"
          [class]="inputClass"
        />
      }

      <label for="delete-account-email" class="mt-4 block text-sm text-[var(--color-text-muted)]">
        {{ 'common.typeToConfirm' | transloco: { text: email() } }}
      </label>
      <input
        id="delete-account-email"
        type="email"
        autocomplete="off"
        [ngModel]="typed()"
        (ngModelChange)="typed.set($event)"
        [class]="inputClass"
      />

      @if (error()) {
        <p class="mt-3 text-sm text-[var(--color-danger)]" role="alert">{{ error() }}</p>
      }

      <ng-container footer>
        <ui-button type="button" variant="ghost" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </ui-button>
        <ui-button
          type="button"
          variant="danger"
          [loading]="busy()"
          [disabled]="busy() || !ready()"
          (click)="submit()"
        >
          {{ 'profile.delete.confirm' | transloco }}
        </ui-button>
      </ng-container>
    </ui-modal>
  `,
})
export class DeleteAccountDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly hasPassword = input(false);
  readonly cancelled = output<void>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly typed = signal('');
  protected readonly password = signal('');
  protected readonly deleteContent = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly email = computed(() => this.auth.currentUser()?.email ?? '');
  protected readonly ready = computed(
    () =>
      this.typed().trim().toLowerCase() === this.email().toLowerCase() &&
      (!this.hasPassword() || this.password().length > 0),
  );

  protected submit(): void {
    if (this.busy() || !this.ready()) return;
    this.busy.set(true);
    this.error.set('');
    this.userService
      .deleteAccount({
        password: this.hasPassword() ? this.password() : undefined,
        confirmEmail: this.typed().trim(),
        deleteContent: this.deleteContent(),
      })
      .subscribe({
        next: () => {
          this.auth.logout();
          this.toast.success(this.transloco.translate('profile.delete.done'));
          void this.router.navigateByUrl('/events');
        },
        error: (err: { body?: { code?: string } }) => {
          this.busy.set(false);
          const code = err.body?.code;
          const known = ['wrongPassword', 'emailMismatch', 'adminCannotDelete'];
          this.error.set(
            this.transloco.translate(
              known.includes(code ?? '')
                ? `profile.delete.errors.${code}`
                : 'profile.delete.errors.generic',
            ),
          );
        },
      });
  }
}
