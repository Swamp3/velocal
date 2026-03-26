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
import { DatePipe } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EventService } from '@core/services/event.service';
import { AuthService } from '@core/services/auth.service';
import { FavoriteService } from '@core/services/favorite.service';
import { SeriesService } from '@core/services/series.service';
import { PostService } from '@core/services/post.service';
import { CyclingEvent, PostListItem, RaceSeries } from '@shared/models';
import { ButtonComponent, ChipComponent, SkeletonComponent, ToastService } from '@shared/ui';
import {
  DisciplineChipComponent,
  EventStatusBadgeComponent,
  EmptyStateComponent,
  EventMiniMapComponent,
  NewsCardComponent,
} from '@shared/components';

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
    EventMiniMapComponent,
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
        this.loadSeries(id);
        this.loadLinkedPosts(id);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
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
