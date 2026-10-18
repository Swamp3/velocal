import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityPoll, PollResultsVisibility, PollVisibility } from '@shared/models';
import { ButtonComponent, ButtonStyleDirective, IconButtonComponent, InputComponent, ModalComponent } from '@shared/ui';

export interface PollEdit {
  question: string;
  resultsVisibility: PollResultsVisibility;
  visibility: PollVisibility;
  /** ISO date, or null to remove the closing time. */
  closesAt: string | null;
  /** Existing options carry their id so votes are kept. */
  options: { id?: string; label: string }[];
}

/** `YYYY-MM-DDTHH:mm` in local time, the value format of a datetime-local input. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Dialog to edit a poll. The parent saves it and closes the dialog. */
@Component({
  selector: 'app-poll-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe, ModalComponent, ButtonComponent, InputComponent, ButtonStyleDirective, IconButtonComponent],
  templateUrl: './poll-edit-dialog.component.html',
})
export class PollEditDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);

  readonly poll = input.required<CommunityPoll>();
  readonly saving = input(false);
  readonly saved = output<PollEdit>();
  readonly closed = output<void>();

  protected readonly form = this.fb.nonNullable.group({
    question: ['', Validators.required],
    resultsVisibility: this.fb.nonNullable.control<PollResultsVisibility>('members'),
    visibility: this.fb.nonNullable.control<PollVisibility>('members'),
    closesAt: [''],
    options: this.fb.array<{ id: string | null; label: string }>([]),
  });

  protected get options(): FormArray {
    return this.form.controls.options;
  }

  ngOnInit(): void {
    const poll = this.poll();
    this.form.patchValue({
      question: poll.question,
      resultsVisibility: poll.resultsVisibility,
      visibility: poll.visibility,
      closesAt: toLocalInput(poll.closesAt),
    });
    for (const option of poll.options) this.options.push(this.optionGroup(option.id, option.label));
  }

  protected addOption(): void {
    if (this.options.length < 12) this.options.push(this.optionGroup(null, ''));
  }

  protected removeOption(index: number): void {
    if (this.options.length <= 2) return;
    const control = this.options.at(index);
    if (
      control.value.id &&
      !window.confirm(this.transloco.translate('communities.polls.removeOptionConfirm'))
    ) {
      return;
    }
    this.options.removeAt(index);
  }

  protected canSave(): boolean {
    const labels = this.options.controls
      .map((c) => (c.value.label as string).trim())
      .filter(Boolean);
    return this.form.controls.question.value.trim().length > 0 && labels.length >= 2;
  }

  protected save(): void {
    if (!this.canSave()) return;
    const raw = this.form.getRawValue();
    this.saved.emit({
      question: raw.question.trim(),
      resultsVisibility: raw.resultsVisibility,
      visibility: raw.visibility,
      closesAt: raw.closesAt ? new Date(raw.closesAt).toISOString() : null,
      options: this.options.controls
        .map((c) => ({
          id: (c.value.id as string | null) ?? undefined,
          label: (c.value.label as string).trim(),
        }))
        .filter((option) => option.label),
    });
  }

  private optionGroup(id: string | null, label: string) {
    return this.fb.nonNullable.group({ id: [id as string | null], label: [label] });
  }
}
