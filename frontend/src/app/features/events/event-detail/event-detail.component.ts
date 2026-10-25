import { DatePipe } from '@angular/common';
import { toMetaDescription } from '@shared/utils/meta-text';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  Pipe,
  PipeTransform,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { RouteService } from '@core/services/route.service';
import { EventHostContext, EventService } from '@core/services/event.service';
import { FavoriteService } from '@core/services/favorite.service';
import { PostService } from '@core/services/post.service';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AddToCalendarComponent, DisciplineChipComponent, EventClassesComponent, EmptyStateComponent, EventDetailMapComponent, EventStatusBadgeComponent, NewsCardComponent, RichTextViewComponent, ShareButtonComponent } from '@shared/components';
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '@shared/utils/map-links';
import { CyclingEvent, formatDistance, PostListItem } from '@shared/models';
import { EventMeetupEditComponent } from '../event-meetup-edit/event-meetup-edit.component';
import { EventCommentsComponent } from '../event-comments/event-comments.component';
import { EventInviteComponent } from '../event-invite/event-invite.component';
import { EventRsvpComponent } from '../event-rsvp/event-rsvp.component';
import { EventImportInfoComponent } from '../event-import-info/event-import-info.component';
import {
  ActionMenuComponent,
  type ActionMenuItem,
  ChipComponent,
  IconButtonComponent,
  SkeletonComponent,
  ToastService,
} from '@shared/ui';
import { normalizeCoords } from '@shared/utils/coords';
import { eventEndTime, eventStartTime, formatTime } from '@shared/utils/event-date';
import { LocaleService } from '@core/services/locale.service';

@Pipe({ name: 'externalUrlDisplay' })
export class ExternalUrlDisplayPipe implements PipeTransform {
  transform(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  }
}

@Component({
  selector: 'app-event-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    TranslocoPipe,
    SkeletonComponent,
    AddToCalendarComponent,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    EmptyStateComponent,
    EventDetailMapComponent,
    ExternalUrlDisplayPipe,
    ChipComponent,
    NewsCardComponent,
    RichTextViewComponent,
    EventRsvpComponent,
    EventInviteComponent,
    EventCommentsComponent,
    EventMeetupEditComponent,
    ShareButtonComponent,
    IconButtonComponent,
    ActionMenuComponent,
    EventImportInfoComponent,
    EventClassesComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly routeService = inject(RouteService);
  private readonly favoriteService = inject(FavoriteService);
  private readonly postService = inject(PostService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);

  protected readonly hostContext: EventHostContext = {};
  protected readonly event = signal<CyclingEvent | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly favoriteLoading = signal(false);
  protected readonly deleteLoading = signal(false);
  protected readonly linkedPosts = signal<PostListItem[]>([]);

  protected readonly isAdmin = computed(() => !!this.auth.currentUser()?.isAdmin);
  protected readonly startTime = computed(() => eventStartTime(this.event()));
  protected readonly endTime = computed(() => eventEndTime(this.event()));
  protected readonly registrationStartTime = computed(() =>
    formatTime(this.event()?.registrationStart),
  );
  protected readonly registrationNotOpenYet = computed(() => {
    const start = this.event()?.registrationStart;
    return !!start && new Date(start).getTime() > Date.now();
  });
  protected readonly deadlineTime = computed(() => formatTime(this.event()?.registrationDeadline));
  private reloadedForViewer = false;
  private loadedAnonymously = false;

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (!user || !this.loadedAnonymously || this.reloadedForViewer) return;
      this.reloadedForViewer = true;
      untracked(() => {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) return;
        this.loadEvent(id);
        this.favoriteService.loadFavorites();
      });
    });
  }

  protected readonly isFavorite = computed(() => {
    const ev = this.event();
    if (!ev) return false;
    return this.favoriteService.isFavorite(ev.id);
  });

  /** Query params that keep the community context when leaving to edit and coming back. */
  /** One line for the share sheet: when and where. */
  protected shareText(): string {
    const event = this.event();
    if (!event) return '';
    return [this.formatEventDate(event.startDate, event.endDate), event.locationName]
      .filter(Boolean)
      .join(' · ');
  }

  /** Tells the route map which event it was opened from, so its back link returns there. */
  protected mapQuery(): Record<string, string> {
    const id = this.event()?.id;
    return id ? { ...this.hostQuery(), event: id } : this.hostQuery();
  }

  protected hostQuery(): Record<string, string> {
    const { community, subgroup } = this.hostContext;
    if (!community) return {};
    return subgroup ? { community, subgroup } : { community };
  }

  /** Where "back" leads: the community the event was opened from, else the event list. */
  protected readonly back = computed(() => {
    const ev = this.event();
    const community =
      this.hostContext.community ?? (ev?.communityId ? ev.hostCommunity?.slug : null);
    if (!community) {
      return { commands: ['/events'], labelKey: 'events.detail.backToList' };
    }
    const subgroup = this.hostContext.subgroup;
    return {
      commands: subgroup
        ? ['/communities', community, 'subgroups', subgroup]
        : ['/communities', community],
      labelKey: 'events.detail.backToCommunity',
    };
  });

  protected readonly canEdit = computed(() => {
    const ev = this.event();
    const user = this.auth.currentUser();
    if (!ev || !user) return false;
    if (ev.communityId) return ev.canEdit === true;
    return ev.createdById === user.id || !!user.isAdmin;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    const query = this.route.snapshot.queryParamMap;
    this.hostContext.community = query.get('community') ?? undefined;
    this.hostContext.subgroup = query.get('subgroup') ?? undefined;
    this.loadedAnonymously = !this.auth.isAuthenticated();
    this.loadEvent(id);

    if (!this.loadedAnonymously) {
      this.favoriteService.loadFavorites();
    }
  }

  protected toggleFavorite(): void {
    const ev = this.event();
    if (!ev) return;

    this.favoriteLoading.set(true);
    const action = this.isFavorite()
      ? this.favoriteService.removeFavorite(ev.id)
      : this.favoriteService.addFavorite(ev.id);

    action.subscribe({
      next: () => this.favoriteLoading.set(false),
      error: () => this.favoriteLoading.set(false),
    });
  }

  protected navigationItems(place: string): ActionMenuItem[] {
    return [
      { id: 'google', label: 'Google Maps', icon: 'open_in_new', href: googleMapsDirectionsUrl(place) },
      { id: 'apple', label: 'Apple Maps', icon: 'open_in_new', href: appleMapsDirectionsUrl(place) },
    ];
  }

  /** Less common admin actions, kept in the "more" menu next to the edit button. */
  protected adminActions(event: CyclingEvent): ActionMenuItem[] {
    const busy = this.deleteLoading();
    const items: ActionMenuItem[] = [
      {
        id: 'delete',
        icon: 'delete',
        danger: true,
        disabled: busy,
        label: this.transloco.translate(
          event.recurrenceId ? 'event.series.deleteOne' : 'event.actions.delete',
        ),
      },
    ];
    if (event.recurrenceId) {
      items.push({
        id: 'stopSeries',
        icon: 'event_busy',
        danger: true,
        disabled: busy,
        label: this.transloco.translate('event.series.stop'),
      });
    }
    return items;
  }

  protected onAdminAction(id: string): void {
    if (id === 'delete') this.deleteEvent();
    else if (id === 'stopSeries') this.stopSeries();
  }

  protected deleteEvent(): void {
    const ev = this.event();
    if (!ev) return;

    const msg = this.transloco.translate(
      ev.recurrenceId ? 'event.series.deleteOneConfirm' : 'event.form.deleteConfirm',
    );
    if (!confirm(msg)) return;

    this.deleteLoading.set(true);
    this.eventService.deleteEvent(ev.id).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('event.form.success.delete'));
        this.router.navigate(this.back().commands);
      },
      error: () => this.deleteLoading.set(false),
    });
  }

  protected readonly distance = formatDistance;

  protected onMeetupUpdated(updated: CyclingEvent): void {
    this.event.set(updated);
  }

  protected downloadGpx(routeId: string, fileId: string, label: string): void {
    this.routeService.download(routeId, fileId, label);
  }

  protected stopSeries(): void {
    const ev = this.event();
    if (!ev?.recurrenceId) return;
    if (!confirm(this.transloco.translate('event.series.stopConfirm'))) return;
    this.deleteLoading.set(true);
    this.eventService.stopSeries(ev.id).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('event.series.stopped'));
        this.router.navigate(this.back().commands);
      },
      error: () => this.deleteLoading.set(false),
    });
  }

  private loadEvent(id: string): void {
    this.eventService.getEvent(id, this.hostContext).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
        this.applySeo(event);
        this.loadLinkedPosts(id);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.seo.setMeta({
          title: this.transloco.translate('event.notFound'),
          description: '',
          noindex: true,
        });
      },
    });
  }

  private applySeo(event: CyclingEvent): void {
    const coords = normalizeCoords(event.coordinates);
    const lang = this.transloco.getActiveLang();
    const url = this.seo.pageUrl(`/events/${event.id}`);
    const image = this.seo.ogImage(event.imageUrl);
    const disciplineName = event.discipline?.nameTranslations?.[lang] ?? event.disciplineSlug;

    const dateLabel = this.formatEventDate(event.startDate, event.endDate);
    const venue = event.locationName ?? '';
    const shortDesc =
      toMetaDescription([disciplineName, dateLabel, venue].filter(Boolean).join(' · '), 260) ||
      toMetaDescription(event.description);

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: event.name,
      description: shortDesc,
      startDate: event.startDate,
      endDate: event.endDate ?? event.startDate,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(url ? { url } : {}),
      image,
      organizer: { '@type': 'Organization', name: 'VeloCal', url: this.seo.siteUrl || undefined },
      ...(event.externalUrl
        ? {
            offers: {
              '@type': 'Offer',
              url: event.externalUrl,
              availability: 'https://schema.org/InStock',
            },
          }
        : {}),
      ...(venue
        ? {
            location: {
              '@type': 'Place',
              name: venue,
              ...(event.address ? { address: event.address } : {}),
              ...(coords
                ? {
                    geo: {
                      '@type': 'GeoCoordinates',
                      latitude: coords.lat,
                      longitude: coords.lng,
                    },
                  }
                : {}),
            },
          }
        : {}),
    };

    this.seo.setMeta({
      title: event.name,
      description: shortDesc,
      url,
      image,
      type: 'event',
      jsonLd,
    });
  }

  private formatEventDate(start: string, end: string | null | undefined): string {
    const locale = this.localeService.intlLocale();
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    try {
      const s = new Date(start).toLocaleDateString(locale, opts);
      if (!end || end === start) return s;
      return `${s} – ${new Date(end).toLocaleDateString(locale, opts)}`;
    } catch {
      return start;
    }
  }

  private loadLinkedPosts(eventId: string): void {
    this.postService.getPosts({ eventId, limit: 5 }).subscribe({
      next: (res) => this.linkedPosts.set(res.data),
    });
  }
}
