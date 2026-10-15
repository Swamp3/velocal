import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService, AuditEntry } from '@core/services/admin.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { PaginationComponent, SkeletonComponent } from '@shared/ui';

/** Read-only history of what site admins did. */
@Component({
  selector: 'app-admin-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, TranslocoPipe, PaginationComponent, SkeletonComponent],
  templateUrl: './audit-log.component.html',
})
export class AuditLogComponent implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly limit = 30;
  protected readonly query = signal('');
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  protected onSearch(q: string): void {
    this.query.set(q);
    this.page.set(1);
    this.load();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected details(entry: AuditEntry): string {
    if (!entry.details) return '';
    return Object.entries(entry.details)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getAuditLog({ q: this.query() || undefined, page: this.page() }).subscribe({
      next: (res) => {
        this.entries.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
