import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent, InputComponent } from '@shared/ui';

/** Email invite field. The parent performs the request and translates the labels. */
@Component({
  selector: 'app-invite-by-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './invite-by-email.component.html',
})
export class InviteByEmailComponent {
  private readonly fb = inject(FormBuilder);

  readonly label = input.required<string>();
  readonly action = input.required<string>();
  readonly submitting = input(false);

  readonly invited = output<string>();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.invited.emit(this.form.controls.email.value.trim());
  }
}
