import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '@shared/components';
import { Community, Subgroup, subgroupVisibilityVariant } from '@shared/models';
import { BadgeComponent, SkeletonComponent } from '@shared/ui';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-community-subgroups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, SkeletonComponent, EmptyStateComponent, BadgeComponent],
  templateUrl: './community-subgroups.component.html',
})
export class CommunitySubgroupsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly communityService = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly community = signal<Community | null>(null);
  protected readonly subgroups = signal<Subgroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly outlineLinkClass =
    'inline-flex items-center justify-center rounded-[var(--radius-default)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.fail();
      return;
    }

    forkJoin({
      community: this.communityService.getBySlug(slug),
      subgroups: this.communityService.listSubgroups(slug),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ community, subgroups }) => {
          this.community.set(community);
          this.subgroups.set(subgroups);
          this.loading.set(false);
        },
        error: () => this.fail(),
      });
  }

  protected visibilityVariant(visibility: Subgroup['visibility']) {
    return subgroupVisibilityVariant(visibility);
  }

  private fail(): void {
    this.error.set(true);
    this.loading.set(false);
  }
}
