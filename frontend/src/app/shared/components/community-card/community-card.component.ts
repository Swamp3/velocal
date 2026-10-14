import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Community, communityInitials, communityVisibilityVariant } from '@shared/models';
import { BadgeComponent } from '@shared/ui';

@Component({
  selector: 'app-community-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, BadgeComponent],
  host: { class: 'block h-full' },
  templateUrl: './community-card.component.html',
})
export class CommunityCardComponent {
  readonly community = input.required<Community>();

  protected readonly initials = computed(() => communityInitials(this.community().name));
  protected readonly visibilityVariant = computed(() =>
    communityVisibilityVariant(this.community().visibility),
  );
}
