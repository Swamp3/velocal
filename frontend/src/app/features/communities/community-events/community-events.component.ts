import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CommunityService } from '@core/services/community.service';
import { EventService } from '@core/services/event.service';
import { CyclingEvent } from '@shared/models';
import {
  ActionMenuComponent,
  type ActionMenuItem,
  ButtonStyleDirective,
  IconButtonComponent,
  ToastService,
} from '@shared/ui';

@Component({
  selector: 'app-community-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    DatePipe,
    ReactiveFormsModule,
    IconButtonComponent,
    ButtonStyleDirective,
    ActionMenuComponent,
  ],
  templateUrl: './community-events.component.html',
})
export class CommunityEventsComponent implements OnInit {
  private readonly communities = inject(CommunityService);
  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly communitySlug = input.required<string>();
  readonly subgroupSlug = input<string>();
  readonly canCreate = input(false);

  protected readonly events = signal<CyclingEvent[]>([]);
  protected readonly loading = signal(true);

  protected readonly sharing = signal(false);
  protected readonly results = signal<CyclingEvent[]>([]);
  protected readonly picked = signal<CyclingEvent | null>(null);
  protected readonly busy = signal(false);
  protected readonly searchForm = new FormGroup({ q: new FormControl('', { nonNullable: true }) });
  protected readonly meetupForm = new FormGroup({
    meetupPlace: new FormControl('', { nonNullable: true }),
    meetupAt: new FormControl('', { nonNullable: true }),
    meetupNote: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.load();
  }

  protected eventQuery(): Record<string, string> {
    const subgroup = this.subgroupSlug();
    return subgroup
      ? { community: this.communitySlug(), subgroup }
      : { community: this.communitySlug() };
  }

  protected createLink(): string[] {
    const subgroup = this.subgroupSlug();
    return subgroup
      ? ['/communities', this.communitySlug(), 'subgroups', subgroup, 'events', 'new']
      : ['/communities', this.communitySlug(), 'events', 'new'];
  }

  protected addMenu(): ActionMenuItem[] {
    return [
      {
        id: 'share',
        icon: 'event_available',
        label: this.transloco.translate('communities.events.share'),
      },
    ];
  }

  protected onAddMenu(id: string): void {
    if (id === 'share') this.toggleSharing();
  }

  protected toggleSharing(): void {
    this.sharing.update((open) => !open);
    if (this.sharing() && this.results().length === 0) this.search();
  }

  protected search(): void {
    const q = this.searchForm.controls.q.value.trim();
    this.eventService.getEvents({ q: q || undefined, limit: 8 }).subscribe({
      next: (page) => this.results.set(page.data.filter((event) => !event.communityId)),
      error: () => this.results.set([]),
    });
  }

  protected pick(event: CyclingEvent): void {
    this.picked.set(event);
  }

  protected submitShare(): void {
    const event = this.picked();
    if (!event || this.busy()) return;
    const { meetupPlace, meetupAt, meetupNote } = this.meetupForm.getRawValue();
    this.busy.set(true);
    this.communities
      .shareEvent(
        this.communitySlug(),
        {
          eventId: event.id,
          meetupPlace: meetupPlace || undefined,
          meetupAt: meetupAt ? new Date(meetupAt).toISOString() : undefined,
          meetupNote: meetupNote || undefined,
        },
        this.subgroupSlug(),
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.picked.set(null);
          this.sharing.set(false);
          this.meetupForm.reset();
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.toast.error(this.transloco.translate('events.rsvp.error'));
        },
      });
  }

  protected unshare(event: CyclingEvent): void {
    this.communities.unshareEvent(this.communitySlug(), event.id, this.subgroupSlug()).subscribe({
      next: () => this.events.update((events) => events.filter((e) => e.id !== event.id)),
    });
  }

  private load(): void {
    this.communities.listEvents(this.communitySlug(), this.subgroupSlug()).subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected readonly inputClass =
    'w-full rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';
}
