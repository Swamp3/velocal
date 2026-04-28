import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminService,
  MissingDataType,
} from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CyclingEvent, Discipline } from '@shared/models';
import {
  BadgeComponent,
  BadgeVariant,
  PaginationComponent,
  SkeletonComponent,
} from '@shared/ui';

interface MissingEvent extends CyclingEvent {
  missingFields: string[];
}

type FilterTab = 'all' | MissingDataType;

const TAB_OPTIONS: FilterTab[] = ['all', 'url', 'address', 'coordinates', 'description'];

const FIELD_BADGE_VARIANT: Record<string, BadgeVariant> = {
  url: 'danger',
  address: 'warning',
  coordinates: 'warning',
  description: 'neutral',
};

@Component({
  selector: 'app-missing-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    BadgeComponent,
    PaginationComponent,
    SkeletonComponent,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './missing-data.component.html',
})
export class MissingDataComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly transloco = inject(TranslocoService);

  protected readonly events = signal<MissingEvent[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly limit = signal(20);
  protected readonly activeTab = signal<FilterTab>('all');
  protected readonly stats = signal<Record<string, number>>({});
  protected readonly tabOptions = TAB_OPTIONS;

  ngOnInit(): void {
    this.loadStats();
    this.loadEvents();
  }

  protected disciplineName(d: Discipline | undefined): string {
    if (!d) return '—';
    const lang = this.transloco.getActiveLang();
    return d.nameTranslations[lang] ?? d.nameTranslations['en'] ?? d.slug;
  }

  protected fieldVariant(field: string): BadgeVariant {
    return FIELD_BADGE_VARIANT[field] ?? 'neutral';
  }

  protected onTabChange(tab: FilterTab): void {
    this.activeTab.set(tab);
    this.page.set(1);
    this.loadEvents();
  }

  protected onPageChange(p: number): void {
    this.page.set(p);
    this.loadEvents();
  }

  private loadEvents(): void {
    const tab = this.activeTab();
    this.admin
      .getMissingData({
        type: tab === 'all' ? undefined : tab,
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({
        next: (res) => {
          this.events.set(res.data as MissingEvent[]);
          this.total.set(res.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadStats(): void {
    this.admin.getMissingDataStats().subscribe({
      next: (s) => this.stats.set(s),
    });
  }
}
