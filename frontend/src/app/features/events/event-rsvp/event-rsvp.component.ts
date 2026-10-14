import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { EventHostContext, EventService } from '@core/services/event.service';
import { EventRsvpStatus } from '@shared/models';
import { ToastService } from '@shared/ui';

@Component({
  selector: 'app-event-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './event-rsvp.component.html',
})
export class EventRsvpComponent {
  private readonly events = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  protected readonly auth = inject(AuthService);

  readonly eventId = input.required<string>();
  readonly count = input(0);
  readonly myRsvp = input<EventRsvpStatus | null>(null);
  readonly canSeeList = input(false);
  readonly hostContext = input<EventHostContext>();

  private readonly countOverride = signal<number | null>(null);
  private readonly mineOverride = signal<EventRsvpStatus | null | undefined>(undefined);

  protected readonly going = computed(() => this.countOverride() ?? this.count());
  protected readonly mine = computed(() =>
    this.mineOverride() === undefined ? this.myRsvp() : this.mineOverride(),
  );
  protected readonly busy = signal(false);
  protected readonly listOpen = signal(false);
  protected readonly people = signal<
    { userId: string; displayName: string; status: EventRsvpStatus }[]
  >([]);

  protected readonly choices: EventRsvpStatus[] = ['going', 'maybe', 'declined'];

  protected choose(status: EventRsvpStatus): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.events.setRsvp(this.eventId(), status, this.hostContext()).subscribe({
      next: (event) => {
        this.countOverride.set(event.rsvpCount ?? 0);
        this.mineOverride.set(event.myRsvp ?? status);
        this.busy.set(false);
        if (this.listOpen()) this.loadPeople();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.transloco.translate('events.rsvp.error'));
      },
    });
  }

  protected togglePeople(): void {
    const open = !this.listOpen();
    this.listOpen.set(open);
    if (open) this.loadPeople();
  }

  private loadPeople(): void {
    this.events.listRsvps(this.eventId(), this.hostContext()).subscribe({
      next: (people) => this.people.set(people),
      error: () => this.people.set([]),
    });
  }
}
