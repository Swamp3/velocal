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
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@shared/ui';
import { ButtonComponent, InputComponent } from '@shared/ui';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        this.router.navigateByUrl('/events');
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(
          err.status === 401
            ? 'Ungültige Anmeldedaten'
            : 'Anmeldung fehlgeschlagen',
        );
      },
    });
  }

  protected fieldError(name: 'email' | 'password'): string {
    const ctrl = this.form.controls[name];
    if (!ctrl.touched || ctrl.valid) return '';
    if (ctrl.hasError('required')) return 'Pflichtfeld';
    if (ctrl.hasError('email')) return 'Ungültige E-Mail';
    if (ctrl.hasError('minlength')) return 'Mindestens 8 Zeichen';
    return '';
  }
}
