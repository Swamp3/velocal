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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EventService } from '@core/services/event.service';
import { AuthService } from '@core/services/auth.service';
import { FavoriteService } from '@core/services/favorite.service';
import { CyclingEvent } from '@shared/models';
import { ButtonComponent, SkeletonComponent } from '@shared/ui';
import {
  DisciplineChipComponent,
  EventStatusBadgeComponent,
  EmptyStateComponent,
  EventMiniMapComponent,
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
    ButtonComponent,
    SkeletonComponent,
    DisciplineChipComponent,
    EventStatusBadgeComponent,
    EmptyStateComponent,
    EventMiniMapComponent,
    ExternalUrlDisplayPipe,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly favoriteService = inject(FavoriteService);

  protected readonly event = signal<CyclingEvent | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly favoriteLoading = signal(false);

  protected readonly isFavorite = computed(() => {
    const ev = this.event();
    if (!ev) return false;
    return this.favoriteService.isFavorite(ev.id);
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

  private loadEvent(id: string): void {
    this.eventService.getEvent(id).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
