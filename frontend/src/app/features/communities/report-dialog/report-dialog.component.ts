import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonComponent, ModalComponent, ToastService } from '@shared/ui';

export type ReportTarget = { type: 'community' | 'post' | 'comment'; id?: string };

const REASONS = ['spam', 'abuse', 'inappropriate', 'illegal', 'other'] as const;

/** Dialog for reporting a community, post or comment to the site admins. */
@Component({
  selector: 'app-report-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe, ModalComponent, ButtonComponent],
  template: `
    <ui-modal [title]="'report.title.' + target().type | transloco" (closed)="closed.emit()">
      <p class="text-sm text-[var(--color-text-muted)]">{{ 'report.intro' | transloco }}</p>

      <fieldset class="mt-4 space-y-2">
        <legend class="text-sm font-medium text-[var(--color-text)]">
          {{ 'report.reason' | transloco }}
        </legend>
        @for (option of reasons; track option) {
          <label class="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="radio"
              name="report-reason"
              [value]="option"
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
            />
            {{ 'report.reasons.' + option | transloco }}
          </label>
        }
      </fieldset>

      <label for="report-note" class="mt-4 block text-sm font-medium text-[var(--color-text)]">
        {{ 'report.note' | transloco }}
      </label>
      <textarea
        id="report-note"
        rows="3"
        maxlength="1000"
        [ngModel]="note()"
        (ngModelChange)="note.set($event)"
        class="mt-1.5 w-full rounded-[var(--radius-default)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--color-primary)]"
      ></textarea>

      <ng-container footer>
        <ui-button type="button" variant="ghost" (click)="closed.emit()">
          {{ 'common.cancel' | transloco }}
        </ui-button>
        <ui-button type="button" [loading]="sending()" [disabled]="sending()" (click)="send()">
          {{ 'report.send' | transloco }}
        </ui-button>
      </ng-container>
    </ui-modal>
  `,
})
export class ReportDialogComponent {
  private readonly communities = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly communitySlug = input.required<string>();
  readonly target = input.required<ReportTarget>();
  readonly closed = output<void>();

  protected readonly reasons = REASONS;
  protected readonly reason = signal<(typeof REASONS)[number]>('spam');
  protected readonly note = signal('');
  protected readonly sending = signal(false);

  protected send(): void {
    if (this.sending()) return;
    this.sending.set(true);
    const target = this.target();
    this.communities
      .report(this.communitySlug(), {
        targetType: target.type,
        targetId: target.id,
        reason: this.reason(),
        note: this.note().trim() || undefined,
      })
      .subscribe({
        next: (result) => {
          this.sending.set(false);
          this.toast.success(
            this.transloco.translate(result.alreadyReported ? 'report.already' : 'report.sent'),
          );
          this.closed.emit();
        },
        error: () => {
          this.sending.set(false);
          this.toast.error(this.transloco.translate('report.error'));
        },
      });
  }
}
