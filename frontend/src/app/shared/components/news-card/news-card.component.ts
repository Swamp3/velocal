import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { PostListItem } from '@shared/models';
import { ChipComponent } from '@shared/ui';

@Component({
  selector: 'app-news-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TranslocoPipe, ChipComponent],
  templateUrl: './news-card.component.html',
})
export class NewsCardComponent {
  readonly post = input.required<PostListItem>();
  readonly pinned = input(false);
}
