import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminService,
  DuplicateEvent,
  DuplicateGroup,
  MissingAtSourceEvent,
} from '@core/services/admin.service';
import { EventService } from '@core/services/event.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BadgeComponent, ButtonComponent, ButtonStyleDirective, PaginationComponent, SkeletonComponent, ToastService } from '@shared/ui';

export type DuplicateMode = 'duplicates' | 'source';

/**
 * Data quality lists for imported events: groups that probably describe the
 * same event, and upcoming events their source does not list any more.
 */
@Component({
  selector: 'app-duplicate-events',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    DatePipe,
    RouterLink,
    BadgeComponent,
    ButtonComponent,
    PaginationComponent,
    SkeletonComponent, ButtonStyleDirective,
  ],
  templateUrl: './duplicate-events.component.html',
})
export class DuplicateEventsComponent {
  private readonly admin = inject(AdminService);
  private readonly events = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly mode = input.required<DuplicateMode>();
  /** Tells the parent how many entries the list has, for the tab badges. */
  readonly counted = output<number>();

  protected readonly groups = signal<DuplicateGroup[]>([]);
  protected readonly missing = signal<MissingAtSourceEvent[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  protected readonly loading = signal(true);
  protected readonly includePast = signal(false);
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.mode();
      untracked(() => {
        this.page.set(1);
        this.load();
      });
    });
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected togglePast(): void {
    this.includePast.update((v) => !v);
    this.page.set(1);
    this.load();
  }

  protected sourceLabel(e: { source: string; sourceName?: string | null }): string {
    return e.source === 'imported'
      ? (e.sourceName ?? 'import')
      : this.transloco.translate('admin.duplicates.manual');
  }

  protected dismiss(group: DuplicateGroup): void {
    this.busyId.set(group.key);
    this.admin.ignoreDuplicates(group.events.map((e) => e.id)).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.transloco.translate('admin.duplicates.dismissed'));
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected askDelete(event: DuplicateEvent | MissingAtSourceEvent): void {
    this.confirmingId.set(event.id);
  }

  protected delete(event: DuplicateEvent | MissingAtSourceEvent): void {
    this.confirmingId.set(null);
    this.busyId.set(event.id);
    this.events.deleteEvent(event.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.transloco.translate('admin.duplicates.deleted'));
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  private load(): void {
    this.loading.set(true);
    if (this.mode() === 'duplicates') {
      this.admin
        .getDuplicateGroups({
          page: this.page(),
          limit: this.limit(),
          includePast: this.includePast(),
        })
        .subscribe({
          next: (res) => this.done(res.total, () => this.groups.set(res.data)),
          error: () => this.loading.set(false),
        });
    } else {
      this.admin.getMissingAtSource({ page: this.page(), limit: this.limit() }).subscribe({
        next: (res) => this.done(res.total, () => this.missing.set(res.data)),
        error: () => this.loading.set(false),
      });
    }
  }

  private done(total: number, apply: () => void): void {
    apply();
    this.total.set(total);
    this.loading.set(false);
    this.counted.emit(total);
  }
}
