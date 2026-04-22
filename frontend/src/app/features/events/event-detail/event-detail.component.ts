import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  Pipe,
  PipeTransform,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { EventService } from '@core/services/event.service';
import { FavoriteService } from '@core/services/favorite.service';
import { PostService } from '@core/services/post.service';
import { SeoService } from '@core/services/seo.service';
import { SeriesService } from '@core/services/series.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  DisciplineChipComponent,
  EmptyStateComponent,
  EventDetailMapComponent,
  EventStatusBadgeComponent,
  NewsCardComponent,
} from '@shared/components';
import { CyclingEvent, PostListItem, RaceSeries } from '@shared/models';
import { ButtonComponent, ChipComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { normalizeCoords } from '@shared/utils/coords';

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
    ButtonComponent,
    SkeletonComponent,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    EmptyStateComponent,
    EventDetailMapComponent,
    ExternalUrlDisplayPipe,
    ChipComponent,
    NewsCardComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly favoriteService = inject(FavoriteService);
  private readonly seriesService = inject(SeriesService);
  private readonly postService = inject(PostService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly event = signal<CyclingEvent | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly favoriteLoading = signal(false);
  protected readonly deleteLoading = signal(false);
  protected readonly eventSeries = signal<RaceSeries[]>([]);
  protected readonly linkedPosts = signal<PostListItem[]>([]);

  protected readonly isFavorite = computed(() => {
    const ev = this.event();
    if (!ev) return false;
    return this.favoriteService.isFavorite(ev.id);
  });

  protected readonly canEdit = computed(() => {
    const ev = this.event();
    const user = this.auth.currentUser();
    if (!ev || !user) return false;
    return ev.createdById === user.id || !!user.isAdmin;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadEvent(id);

    if (this.auth.isAuthenticated()) {
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

  protected deleteEvent(): void {
    const ev = this.event();
    if (!ev) return;

    const msg = this.transloco.translate('event.form.deleteConfirm');
    if (!confirm(msg)) return;

    this.deleteLoading.set(true);
    this.eventService.deleteEvent(ev.id).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('event.form.success.delete'));
        this.router.navigate(['/events']);
      },
      error: () => this.deleteLoading.set(false),
    });
  }

  private loadEvent(id: string): void {
    this.eventService.getEvent(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
        this.applySeo(event);
        this.loadSeries(id);
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

    const dateLabel = this.formatEventDate(event.startDate, event.endDate, lang);
    const venue = event.locationName ?? '';
    const shortDesc =
      [disciplineName, dateLabel, venue].filter(Boolean).join(' · ').slice(0, 260) ||
      (event.description ?? '').slice(0, 200);

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

  private formatEventDate(start: string, end: string | null | undefined, lang: string): string {
    const locale = lang === 'en' ? 'en-GB' : 'de-DE';
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    try {
      const s = new Date(start).toLocaleDateString(locale, opts);
      if (!end || end === start) return s;
      return `${s} – ${new Date(end).toLocaleDateString(locale, opts)}`;
    } catch {
      return start;
    }
  }

  private loadSeries(eventId: string): void {
    this.seriesService.getSeriesForEvent(eventId).subscribe({
      next: (series) => this.eventSeries.set(series),
    });
  }

  private loadLinkedPosts(eventId: string): void {
    this.postService.getPosts({ eventId, limit: 5 }).subscribe({
      next: (res) => this.linkedPosts.set(res.data),
    });
  }
}
