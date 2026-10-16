import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminCommunityRow,
  AdminCommunitySearchParams,
  AdminService,
} from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { communityVisibilityVariant } from '@shared/models';
import { BadgeComponent, PaginationComponent, SegmentedComponent, SegmentedOption, SkeletonComponent } from '@shared/ui';

type Visibility = 'all' | 'public' | 'request' | 'private';
type Sort = NonNullable<AdminCommunitySearchParams['sort']>;

@Component({
  selector: 'app-admin-community-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslocoPipe,
    BadgeComponent,
    PaginationComponent,
    SkeletonComponent, SegmentedComponent,
  ],
  templateUrl: './community-list.component.html',
})
export class CommunityListComponent implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly rows = signal<AdminCommunityRow[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly limit = 20;
  protected readonly query = signal('');
  protected readonly visibility = signal<Visibility>('all');
  protected readonly sort = signal<Sort>('createdAt');
  protected readonly visibilityChoices: SegmentedOption<Visibility>[] = (
    ['all', 'public', 'request', 'private'] as Visibility[]
  ).map((v) => ({
    value: v,
    labelKey: v === 'all' ? 'admin.communities.all' : 'communities.visibility.' + v,
  }));
  protected readonly sortOptions: Sort[] = ['createdAt', 'name', 'members', 'pending', 'reports'];
  protected readonly badge = communityVisibilityVariant;

  ngOnInit(): void {
    this.load();
  }

  protected onSearch(q: string): void {
    this.query.set(q);
    this.page.set(1);
    this.load();
  }

  protected onVisibility(value: Visibility): void {
    this.visibility.set(value);
    this.page.set(1);
    this.load();
  }

  protected onSort(value: Sort): void {
    this.sort.set(value);
    this.page.set(1);
    this.load();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const sort = this.sort();
    const params: AdminCommunitySearchParams = {
      page: this.page(),
      limit: this.limit,
      sort,
      order: sort === 'name' ? 'ASC' : 'DESC',
    };
    if (this.query()) params.q = this.query();
    if (this.visibility() !== 'all')
      params.visibility = this.visibility() as 'public' | 'request' | 'private';
    this.admin.getCommunities(params).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
