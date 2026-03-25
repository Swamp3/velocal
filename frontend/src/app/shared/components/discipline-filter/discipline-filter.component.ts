import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ChipComponent } from '@shared/ui';
import { Discipline } from '@shared/models';

@Component({
  selector: 'app-discipline-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent],
  templateUrl: './discipline-filter.component.html',
})
export class DisciplineFilterComponent {
  readonly disciplines = input.required<Discipline[]>();
  readonly selected = input<string[]>([]);
  readonly selectedChange = output<string[]>();

  private readonly transloco = inject(TranslocoService);

  protected readonly noneSelected = computed(() => this.selected().length === 0);

  protected isSelected(slug: string): boolean {
    return this.selected().includes(slug);
  }

  protected translatedName(d: Discipline): string {
    const lang = this.transloco.getActiveLang();
    return d.nameTranslations[lang] ?? d.nameTranslations['en'] ?? d.slug;
  }

  protected clearAll(): void {
    this.selectedChange.emit([]);
  }

  protected toggle(slug: string): void {
    const current = this.selected();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    this.selectedChange.emit(next);
  }
}
