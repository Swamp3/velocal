import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ImportAction,
  ImportIssue,
  ImportReport,
  ImportReportEntry,
} from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BadgeComponent, BadgeVariant, SegmentedComponent, SegmentedOption } from '@shared/ui';

type Filter = 'all' | 'errors' | 'warnings' | ImportAction;

const ACTION_VARIANT: Record<ImportAction, BadgeVariant> = {
  create: 'success',
  update: 'warning',
  unchanged: 'neutral',
  skip: 'neutral',
  invalid: 'danger',
};

const PAGE = 100;

/** Result of an import check or run: per event what happens and which problems it has. */
@Component({
  selector: 'app-import-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, RouterLink, BadgeComponent, SegmentedComponent],
  templateUrl: './import-report.component.html',
})
export class ImportReportComponent {
  private readonly transloco = inject(TranslocoService);

  readonly report = input.required<ImportReport>();

  protected readonly filter = signal<Filter>('all');
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);
  protected readonly open = signal<Set<number>>(new Set());
  protected readonly actionVariant = ACTION_VARIANT;

  protected readonly filters = computed((): SegmentedOption<Filter>[] => {
    const s = this.report().summary;
    const errorsEntries = this.report().entries.filter((e) => e.issues.some((i) => i.severity === 'error')).length;
    const warningEntries = this.report().entries.filter((e) => e.issues.some((i) => i.severity === 'warning')).length;
    const options: SegmentedOption<Filter>[] = [
      { value: 'all', labelKey: 'admin.imports.report.filter.all', count: this.report().entries.length },
      { value: 'errors', labelKey: 'admin.imports.report.filter.errors', count: errorsEntries },
      { value: 'warnings', labelKey: 'admin.imports.report.filter.warnings', count: warningEntries },
      { value: 'create', labelKey: 'admin.imports.action.create', count: s.create },
      { value: 'update', labelKey: 'admin.imports.action.update', count: s.update },
      { value: 'unchanged', labelKey: 'admin.imports.action.unchanged', count: s.unchanged },
      { value: 'skip', labelKey: 'admin.imports.action.skip', count: s.skip },
      { value: 'invalid', labelKey: 'admin.imports.action.invalid', count: s.invalid },
    ];
    return options.filter((o) => o.value === 'all' || (o.count ?? 0) > 0);
  });

  protected readonly entries = computed((): ImportReportEntry[] => {
    const filter = this.filter();
    const q = this.query().trim().toLowerCase();
    return this.report().entries.filter((entry) => {
      if (filter === 'errors' && !entry.issues.some((i) => i.severity === 'error')) return false;
      if (filter === 'warnings' && !entry.issues.some((i) => i.severity === 'warning')) return false;
      if (filter !== 'all' && filter !== 'errors' && filter !== 'warnings' && entry.action !== filter) return false;
      if (q && !`${entry.name ?? ''} ${entry.externalId ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected readonly visible = computed(() => this.entries().slice(0, this.shown()));

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
    this.shown.set(PAGE);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.shown.set(PAGE);
  }

  protected toggle(index: number): void {
    this.open.update((set) => {
      const next = new Set(set);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /** Issues worth listing; "no coordinates" is only counted, not repeated on every row. */
  protected listed(entry: ImportReportEntry): ImportIssue[] {
    return entry.issues.filter((i) => i.code !== 'noCoordinates');
  }

  protected issueText(issue: ImportIssue): string {
    const key = `admin.imports.issue.${issue.code}`;
    const text = this.transloco.translate(key, { field: issue.field ?? '', ...(issue.params ?? {}) });
    return text === key ? issue.message : text;
  }

  protected severityClass(issue: ImportIssue): string {
    if (issue.severity === 'error') return 'text-[var(--color-danger)]';
    if (issue.severity === 'warning') return 'text-amber-700 dark:text-amber-400';
    return 'text-[var(--color-text-muted)]';
  }

  protected severityIcon(issue: ImportIssue): string {
    if (issue.severity === 'error') return 'block';
    if (issue.severity === 'warning') return 'warning';
    return 'info';
  }

  protected value(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  protected dateLabel(entry: ImportReportEntry): string {
    const raw = entry.startDate;
    if (!raw) return '—';
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
    const date = new Date(day);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString(this.transloco.getActiveLang() === 'en' ? 'en-GB' : 'de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected noCoordinates(): number {
    return this.report().entries.filter((e) => e.issues.some((i) => i.code === 'noCoordinates')).length;
  }
}
