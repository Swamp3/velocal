import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SeriesService } from '@core/services/series.service';
import { AuthService } from '@core/services/auth.service';
import { RaceSeriesDetail } from '@shared/models';
import { ButtonComponent, SkeletonComponent } from '@shared/ui';
import {
  DisciplineChipComponent,
  EmptyStateComponent,
  EventCardComponent,
} from '@shared/components';

@Component({
  selector: 'app-series-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    SkeletonComponent,
    DisciplineChipComponent,
    EmptyStateComponent,
    EventCardComponent,
  ],
  templateUrl: './series-detail.component.html',
})
export class SeriesDetailComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seriesService = inject(SeriesService);

  protected readonly series = signal<RaceSeriesDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.seriesService.getSeriesBySlug(slug).subscribe({
      next: (s) => {
        this.series.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected deleteSeries(): void {
    const s = this.series();
    if (!s) return;
    this.seriesService.deleteSeries(s.id).subscribe({
      next: () => this.router.navigateByUrl('/series'),
    });
  }
}
