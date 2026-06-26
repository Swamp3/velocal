import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AdminService, DailyStats } from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { SkeletonComponent } from '@shared/ui';

type Period = 7 | 30 | 90;

@Component({
  selector: 'app-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, DecimalPipe, PercentPipe, DatePipe, SkeletonComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly loading = signal(true);
  protected readonly period = signal<Period>(30);
  protected readonly totalViews = signal(0);
  protected readonly uniquePaths = signal(0);
  protected readonly uniqueClients = signal(0);
  protected readonly topPages = signal<{ path: string; views: number }[]>([]);
  protected readonly daily = signal<DailyStats[]>([]);

  protected readonly maxViews = computed(() => {
    const pages = this.topPages();
    return pages.length > 0 ? pages[0].views : 1;
  });

  protected readonly maxDailyViews = computed(() => {
    const days = this.daily();
    if (days.length === 0) return 1;
    return Math.max(...days.map((d) => d.views), 1);
  });

  protected readonly maxDailyClients = computed(() => {
    const days = this.daily();
    if (days.length === 0) return 1;
    return Math.max(...days.map((d) => d.uniqueClients), 1);
  });

  protected readonly periods: Period[] = [7, 30, 90];

  ngOnInit(): void {
    this.loadData();
  }

  protected setPeriod(p: Period): void {
    this.period.set(p);
    this.loadData();
  }

  protected barWidth(views: number): number {
    return (views / this.maxViews()) * 100;
  }

  protected percentage(views: number): number {
    const total = this.totalViews();
    return total > 0 ? views / total : 0;
  }

  protected chartBarHeight(views: number): number {
    return (views / this.maxDailyViews()) * 100;
  }

  protected chartClientHeight(clients: number): number {
    return (clients / this.maxDailyClients()) * 100;
  }

  private loadData(): void {
    this.loading.set(true);
    const days = this.period();

    this.admin.getAnalyticsOverview(days).subscribe({
      next: (overview) => {
        this.totalViews.set(overview.totalViews);
        this.uniquePaths.set(overview.uniquePaths);
        this.uniqueClients.set(overview.uniqueClients);
        this.daily.set(overview.daily);
      },
    });

    this.admin.getTopPages(days, 20).subscribe({
      next: (pages) => {
        this.topPages.set(pages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
