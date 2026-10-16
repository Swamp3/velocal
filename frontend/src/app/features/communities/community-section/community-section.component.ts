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
import { ButtonStyleDirective, SkeletonComponent } from '@shared/ui';
import { CommunityFeedComponent } from '../community-feed/community-feed.component';
import { CommunityPollsComponent } from '../community-polls/community-polls.component';

type CommunitySection = 'posts' | 'polls';

@Component({
  selector: 'app-community-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoPipe,
    SkeletonComponent,
    EmptyStateComponent,
    CommunityFeedComponent,
    CommunityPollsComponent, ButtonStyleDirective,
  ],
  templateUrl: './community-section.component.html',
})
export class CommunitySectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly communityService = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly section = signal<CommunitySection>('posts');
  protected readonly communitySlug = signal('');
  protected readonly subgroupSlug = signal<string | null>(null);
  protected readonly backLink = signal<string[]>([]);
  protected readonly backLabel = signal('');
  protected readonly allowed = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    const section = this.route.snapshot.data['section'];
    if (!communitySlug || (section !== 'posts' && section !== 'polls')) {
      this.fail();
      return;
    }

    this.section.set(section);
    this.communitySlug.set(communitySlug);
    this.subgroupSlug.set(subgroupSlug);

    if (subgroupSlug) {
      this.communityService
        .getSubgroup(communitySlug, subgroupSlug)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (subgroup) => {
            this.backLink.set(['/communities', subgroup.communitySlug, 'subgroups', subgroup.slug]);
            this.backLabel.set(subgroup.name);
            this.allowed.set(!!subgroup.myRole || subgroup.viewerIsCommunityAdmin);
            this.loading.set(false);
          },
          error: () => this.fail(),
        });
      return;
    }

    this.communityService
      .getBySlug(communitySlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          this.backLink.set(['/communities', community.slug]);
          this.backLabel.set(community.name);
          this.allowed.set(!!community.myRole);
          this.loading.set(false);
        },
        error: () => this.fail(),
      });
  }

  protected createLink(): string[] {
    const subgroupSlug = this.subgroupSlug();
    const section = this.section();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, section, 'new']
      : ['/communities', this.communitySlug(), section, 'new'];
  }

  private fail(): void {
    this.error.set(true);
    this.loading.set(false);
  }
}
