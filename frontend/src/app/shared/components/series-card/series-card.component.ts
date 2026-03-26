import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { RaceSeries } from '@shared/models';
import { DisciplineChipComponent } from '../discipline-chip/discipline-chip.component';

@Component({
  selector: 'app-series-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, DisciplineChipComponent],
  templateUrl: './series-card.component.html',
})
export class SeriesCardComponent {
  readonly series = input.required<RaceSeries>();
}
