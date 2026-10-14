import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

export interface CommunitySectionLink {
  icon: string;
  labelKey: string;
  commands: string[];
}

@Component({
  selector: 'app-community-section-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './community-section-nav.component.html',
})
export class CommunitySectionNavComponent {
  readonly links = input.required<CommunitySectionLink[]>();
}
