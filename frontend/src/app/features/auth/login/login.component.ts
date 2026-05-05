import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import {
  ButtonComponent,
  InputComponent,
  OtpInputComponent,
  ToastService,
} from '@shared/ui';

type AuthView = 'email' | 'otp' | 'password' | 'forgot';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    InputComponent,
    OtpInputComponent,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly view = signal<AuthView>('email');
  protected readonly loading = signal(false);
  protected readonly otpEmail = signal('');
  protected readonly resendCooldown = signal(0);

  protected readonly forgotSent = signal(false);

  protected readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly otpForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  protected sendOtp(): void {
    if (this.loading()) return;
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const email = this.emailForm.getRawValue().email;

    this.auth.requestOtp(email).subscribe({
      next: () => {
        this.otpEmail.set(email);
        this.view.set('otp');
        this.loading.set(false);
        this.startCooldown();
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(
          err.status === 401
            ? this.transloco.translate('auth.otpCooldown')
            : this.transloco.translate('auth.otpSendFailed'),
        );
      },
    });
  }

  protected verifyOtp(): void {
    if (this.loading() || this.otpForm.invalid) return;

    this.loading.set(true);
    const code = this.otpForm.getRawValue().code;

    this.auth.verifyOtp(this.otpEmail(), code).subscribe({
      next: () => this.router.navigateByUrl('/events'),
      error: (err) => {
        this.loading.set(false);
        this.toast.error(
          err.status === 401
            ? this.transloco.translate('auth.otpInvalid')
            : this.transloco.translate('auth.loginFailed'),
        );
      },
    });
  }

  protected onOtpCompleted(code: string): void {
    this.otpForm.controls.code.setValue(code);
    this.verifyOtp();
  }

  protected resendOtp(): void {
    if (this.loading() || this.resendCooldown() > 0) return;

    this.loading.set(true);
    this.auth.requestOtp(this.otpEmail()).subscribe({
      next: () => {
        this.loading.set(false);
        this.startCooldown();
        this.toast.success(this.transloco.translate('auth.otpResent'));
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.transloco.translate('auth.otpSendFailed'));
      },
    });
  }

  protected showForgotPassword(): void {
    this.view.set('forgot');
    this.forgotSent.set(false);
    const email =
      this.passwordForm.getRawValue().email ||
      this.emailForm.getRawValue().email ||
      this.otpEmail();
    if (email) {
      this.forgotForm.controls.email.setValue(email);
    }
  }

  protected submitForgotPassword(): void {
    if (this.loading() || this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const email = this.forgotForm.getRawValue().email;

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.forgotSent.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.transloco.translate('auth.resetFailed'));
      },
    });
  }

  protected showPasswordLogin(): void {
    this.view.set('password');
    const email = this.emailForm.getRawValue().email || this.otpEmail();
    if (email) {
      this.passwordForm.controls.email.setValue(email);
    }
  }

  protected showOtpLogin(): void {
    this.view.set('email');
  }

  protected loginWithPassword(): void {
    if (this.loading()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password } = this.passwordForm.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/events'),
      error: (err) => {
        this.loading.set(false);
        this.toast.error(
          err.status === 401
            ? this.transloco.translate('auth.invalidCredentials')
            : this.transloco.translate('auth.loginFailed'),
        );
      },
    });
  }

  protected emailError(): string {
    const ctrl = this.emailForm.controls.email;
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return this.transloco.translate('validation.required');
    if (ctrl.hasError('email')) return this.transloco.translate('validation.email');
    return '';
  }

  protected forgotFieldError(): string {
    const ctrl = this.forgotForm.controls.email;
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return this.transloco.translate('validation.required');
    if (ctrl.hasError('email')) return this.transloco.translate('validation.email');
    return '';
  }

  protected passwordFieldError(name: 'email' | 'password'): string {
    const ctrl = this.passwordForm.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return this.transloco.translate('validation.required');
    if (ctrl.hasError('email')) return this.transloco.translate('validation.email');
    if (ctrl.hasError('minlength')) return this.transloco.translate('validation.minLength', { min: 8 });
    return '';
  }

  private startCooldown(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendCooldown.set(60);
    this.resendTimer = setInterval(() => {
      const next = this.resendCooldown() - 1;
      this.resendCooldown.set(next);
      if (next <= 0 && this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }
}
