import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { ButtonComponent, InputComponent, ToastService } from '@shared/ui';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly token = signal('');

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set(this.transloco.translate('auth.resetTokenMissing'));
      return;
    }
    this.token.set(token);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { password } = this.form.getRawValue();

    this.auth.resetPassword(this.token(), password).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('auth.resetSuccess'));
        this.router.navigateByUrl('/events');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401
            ? this.transloco.translate('auth.resetTokenInvalid')
            : this.transloco.translate('auth.resetFailed'),
        );
      },
    });
  }

  protected fieldError(name: 'password' | 'confirmPassword'): string {
    const ctrl = this.form.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required'))
      return this.transloco.translate('validation.required');
    if (ctrl.hasError('minlength'))
      return this.transloco.translate('validation.minLength', { min: 8 });
    if (
      name === 'confirmPassword' &&
      this.form.hasError('passwordMismatch')
    ) {
      return this.transloco.translate('validation.passwordMismatch');
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
