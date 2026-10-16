import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { InputComponent } from '@shared/ui/input/input.component';
import { ModalComponent } from '@shared/ui/modal/modal.component';

const DISMISSED_PREFIX = 'velocal.namePrompt.dismissed.';

/**
 * Asks for a display name after the first sign-in (accounts created by e-mail code have none).
 * Cancelling is remembered per account on this device, so it is asked only once.
 */
@Component({
  selector: 'app-name-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe, ModalComponent, InputComponent, ButtonComponent],
  template: `
    @if (open()) {
      <ui-modal [title]="'namePrompt.title' | transloco" (closed)="cancel()">
        <form
          id="name-prompt-form"
          (submit)="$event.preventDefault(); save(false)"
          class="space-y-4"
        >
          <p class="text-sm text-[var(--color-text-muted)]">
            {{ 'namePrompt.text' | transloco }}
          </p>
          <ui-input
            [label]="'profile.displayName' | transloco"
            [placeholder]="'profile.displayNamePlaceholder' | transloco"
            [formControl]="name"
            autocomplete="nickname"
          />
          <p class="text-sm text-[var(--color-text-muted)]">
            {{ 'namePrompt.hint' | transloco }}
          </p>
        </form>
        <ng-container footer>
          <ui-button type="button" variant="ghost" (click)="cancel()">
            {{ 'common.cancel' | transloco }}
          </ui-button>
          <ui-button
            type="button"
            variant="outline"
            [disabled]="saving() || name.invalid"
            (click)="save(true)"
          >
            {{ 'namePrompt.saveAndProfile' | transloco }}
          </ui-button>
          <ui-button
            type="submit"
            form="name-prompt-form"
            [loading]="saving()"
            [disabled]="saving() || name.invalid"
          >
            {{ 'common.save' | transloco }}
          </ui-button>
        </ng-container>
      </ui-modal>
    }
  `,
})
export class NamePromptComponent {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly router = inject(Router);

  private readonly closedLocally = signal(false);
  protected readonly saving = signal(false);
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
  });

  protected readonly open = computed(() => {
    const user = this.auth.currentUser();
    return !!user && !user.displayName?.trim() && !this.closedLocally() && !this.dismissed(user.id);
  });

  protected cancel(): void {
    const user = this.auth.currentUser();
    if (user) {
      try {
        localStorage.setItem(DISMISSED_PREFIX + user.id, '1');
      } catch {
        // Private mode: it may be asked again next time.
      }
    }
    this.closedLocally.set(true);
  }

  protected save(thenProfile: boolean): void {
    if (this.saving() || this.name.invalid) return;
    this.saving.set(true);
    this.users.updateProfile({ displayName: this.name.value.trim() }).subscribe({
      next: (user) => {
        this.auth.updateCurrentUser(user);
        this.saving.set(false);
        if (thenProfile) void this.router.navigate(['/profile']);
      },
      error: () => this.saving.set(false),
    });
  }

  private dismissed(userId: string): boolean {
    try {
      return localStorage.getItem(DISMISSED_PREFIX + userId) === '1';
    } catch {
      return false;
    }
  }
}
