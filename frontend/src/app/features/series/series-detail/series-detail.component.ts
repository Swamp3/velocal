import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { SeoService } from '@core/services/seo.service';
import { SeriesService } from '@core/services/series.service';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DisciplineChipComponent,
  EmptyStateComponent,
  EventCardComponent,
} from '@shared/components';
import { RaceSeriesDetail } from '@shared/models';
import { ButtonComponent, SkeletonComponent } from '@shared/ui';

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
  private readonly seo = inject(SeoService);

  protected readonly series = signal<RaceSeriesDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.seriesService.getSeriesBySlug(slug).subscribe({
      next: (s) => {
        this.series.set(s);
        this.loading.set(false);
        this.applySeo(s);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.seo.setMeta({ title: 'Series not found', description: '', noindex: true });
      },
    });
  }

  private applySeo(s: RaceSeriesDetail): void {
    const url = this.seo.pageUrl(`/series/${s.slug}`);
    const image = this.seo.ogImage(s.imageUrl);
    const description = (
      s.description ?? `${s.eventCount} events${s.year ? ` · ${s.year}` : ''}`
    ).slice(0, 260);

    const itemListElement = (s.events ?? [])
      .map((entry, i) => {
        const childUrl = this.seo.pageUrl(`/events/${entry.event.id}`);
        if (!childUrl) return null;
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: childUrl,
          name: entry.event.name,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const breadcrumbs = url
      ? [
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Series',
                item: this.seo.pageUrl('/series'),
              },
              { '@type': 'ListItem', position: 2, name: s.name, item: url },
            ],
          },
        ]
      : [];

    this.seo.setMeta({
      title: s.name,
      description,
      url,
      image,
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ItemList',
            name: s.name,
            description,
            ...(url ? { url } : {}),
            itemListElement,
          },
          ...breadcrumbs,
        ],
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
