import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@shared/ui';
import { ButtonComponent, InputComponent } from '@shared/ui';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      displayName: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password, displayName } = this.form.getRawValue();

    this.auth
      .register({ email, password, displayName: displayName || undefined })
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/events');
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.error(
            err.status === 409
              ? 'Diese E-Mail ist bereits registriert'
              : 'Registrierung fehlgeschlagen',
          );
        },
      });
  }

  protected fieldError(
    name: 'displayName' | 'email' | 'password' | 'confirmPassword',
  ): string {
    const ctrl = this.form.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return 'Pflichtfeld';
    if (ctrl.hasError('email')) return 'Ungültige E-Mail';
    if (ctrl.hasError('minlength')) return 'Mindestens 8 Zeichen';

    if (name === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Passwörter stimmen nicht überein';
    }
    return '';
  }
}

function passwordMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pw === confirm ? null : { passwordMismatch: true };
}
