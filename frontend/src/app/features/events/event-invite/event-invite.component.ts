import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError } from '@core/services/api.service';
import { EventService } from '@core/services/event.service';
import { communityErrorKey } from '../../communities/community-error';
import { InviteByEmailComponent } from '@shared/components';
import { ToastService } from '@shared/ui';

@Component({
  selector: 'app-event-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, InviteByEmailComponent],
  templateUrl: './event-invite.component.html',
})
export class EventInviteComponent {
  private readonly events = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly eventId = input.required<string>();

  protected readonly submitting = signal(false);

  protected invite(email: string): void {
    this.submitting.set(true);
    this.events.invite(this.eventId(), email).subscribe({
      next: (result) => {
        this.submitting.set(false);
        const key =
          result.outcome === 'already'
            ? 'events.invite.already'
            : result.outcome === 'self'
              ? 'events.invite.self'
              : result.emailSkipped === 'unverified'
                ? 'events.invite.unverified'
                : result.emailSkipped === 'cap'
                  ? 'events.invite.capped'
                  : result.emailed
                    ? 'events.invite.emailed'
                    : 'events.invite.saved';
        this.toast.success(this.transloco.translate(key));
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.toast.error(this.transloco.translate(communityErrorKey(err)));
      },
    });
  }
}
