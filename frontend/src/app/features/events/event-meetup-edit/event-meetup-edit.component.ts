import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommunityService } from '@core/services/community.service';
import { EventHostContext } from '@core/services/event.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CyclingEvent } from '@shared/models';
import { ButtonComponent, ModalComponent, ToastService } from '@shared/ui';

/** `YYYY-MM-DDTHH:mm` in local time, the value format of a datetime-local input. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Lets club admins and subgroup moderators change the meetup place, time and note of a
 * public event that was added to their club. Hosted events use the normal event form.
 */
@Component({
  selector: 'app-event-meetup-edit',
  imports: [ReactiveFormsModule, TranslocoPipe, ButtonComponent, ModalComponent],
  templateUrl: './event-meetup-edit.component.html',
})
export class EventMeetupEditComponent {
  private readonly communities = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly event = input.required<CyclingEvent>();
  readonly hostContext = input.required<EventHostContext>();
  readonly updated = output<CyclingEvent>();

  protected readonly open = signal(false);
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    meetupPlace: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    meetupAt: new FormControl('', { nonNullable: true }),
    meetupNote: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  protected show(): void {
    const event = this.event();
    this.form.setValue({
      meetupPlace: event.meetupPlace ?? '',
      meetupAt: toLocalInput(event.meetupAt),
      meetupNote: event.meetupNote ?? '',
    });
    this.open.set(true);
  }

  protected hide(): void {
    if (!this.saving()) this.open.set(false);
  }

  protected save(): void {
    const { community, subgroup } = this.hostContext();
    if (!community || this.form.invalid || this.saving()) return;
    const { meetupPlace, meetupAt, meetupNote } = this.form.getRawValue();
    this.saving.set(true);
    this.communities
      .shareEvent(
        community,
        {
          eventId: this.event().id,
          meetupPlace: meetupPlace.trim(),
          meetupAt: meetupAt ? new Date(meetupAt).toISOString() : '',
          meetupNote: meetupNote.trim(),
        },
        subgroup,
      )
      .subscribe({
        next: (event) => {
          this.saving.set(false);
          this.open.set(false);
          this.toast.success(this.transloco.translate('events.detail.meetupSaved'));
          this.updated.emit(event);
        },
        error: (err: { status?: number }) => {
          this.saving.set(false);
          const key = err.status === 422 ? 'validation.badWord' : 'events.detail.meetupError';
          this.toast.error(this.transloco.translate(key));
        },
      });
  }
}
