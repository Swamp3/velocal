import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'ui-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  readonly total = input.required<number>();
  readonly page = input(1);
  readonly limit = input(20);
  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limit())),
  );

  protected readonly pages = computed(() => {
    const tp = this.totalPages();
    const current = this.page();
    const delta = 2;
    const range: number[] = [];

    for (
      let i = Math.max(1, current - delta);
      i <= Math.min(tp, current + delta);
      i++
    ) {
      range.push(i);
    }

    return range;
  });
}
