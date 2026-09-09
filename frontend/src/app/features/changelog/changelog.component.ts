import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ChangelogService } from '@core/services/changelog.service';
import { SeoService } from '@core/services/seo.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '@shared/components';
import { ChangelogEntry } from '@shared/models';
import { BadgeComponent, BadgeVariant, SkeletonComponent } from '@shared/ui';
import { renderInlineMarkdown } from '@shared/utils';

const SECTION_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Added: 'success',
  Changed: 'neutral',
  Fixed: 'warning',
  Removed: 'danger',
  Deprecated: 'danger',
};

@Component({
  selector: 'app-changelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, BadgeComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './changelog.component.html',
})
export class ChangelogComponent implements OnInit {
  private readonly changelog = inject(ChangelogService);
  private readonly seo = inject(SeoService);

  protected readonly entries = signal<ChangelogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly renderItem = renderInlineMarkdown;

  ngOnInit(): void {
    this.seo.setMeta({
      title: 'VeloCal — Changelog',
      description: "What's new in VeloCal — release notes and recent fixes.",
      url: this.seo.pageUrl('/changelog'),
    });

    this.changelog.getChangelog().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected badgeVariant(sectionTitle: string): BadgeVariant {
    return SECTION_BADGE_VARIANT[sectionTitle] ?? 'neutral';
  }
}
