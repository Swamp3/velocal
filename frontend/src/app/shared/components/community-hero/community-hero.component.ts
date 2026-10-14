import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { communityInitials } from '@shared/models';

@Component({
  selector: 'app-community-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './community-hero.component.html',
})
export class CommunityHeroComponent {
  readonly name = input.required<string>();
  readonly heroUrl = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);

  protected readonly initials = computed(() => communityInitials(this.name()));
}
