import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ChipComponent } from '@shared/ui';
import { Discipline } from '@shared/models';

@Component({
  selector: 'app-discipline-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent],
  templateUrl: './discipline-chip.component.html',
})
export class DisciplineChipComponent {
  readonly discipline = input.required<Discipline>();
  readonly selected = input(false);

  private readonly transloco = inject(TranslocoService);

  protected translatedName(): string {
    const lang = this.transloco.getActiveLang();
    return this.discipline().nameTranslations[lang] ?? this.discipline().nameTranslations['en'] ?? '';
  }
}
