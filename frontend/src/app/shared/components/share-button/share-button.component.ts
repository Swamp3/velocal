import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, PLATFORM_ID } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SeoService } from '@core/services/seo.service';
import { IconButtonComponent } from '@shared/ui/icon-button/icon-button.component';
import { ToastService } from '@shared/ui/toast/toast.service';

/**
 * Share icon for an event or community. Opens the system share sheet where the
 * device has one (phones, installed PWA); elsewhere it copies the link.
 */
@Component({
  selector: 'app-share-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, IconButtonComponent],
  template: `
    <button
      type="button"
      uiIconButton
      variant="outline"
      icon="share"
      [label]="'common.share' | transloco"
      (click)="share()"
    ></button>
  `,
})
export class ShareButtonComponent {
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Path of the page, e.g. `/events/123`. */
  readonly path = input.required<string>();
  /** Query parameters the link needs, e.g. the club of a club event. */
  readonly query = input<Record<string, string>>({});
  readonly title = input.required<string>();
  readonly text = input<string>('');

  protected async share(): Promise<void> {
    if (!this.isBrowser) return;
    const url = this.url();
    const data: ShareData = { title: this.title(), url };
    if (this.text()) data.text = this.text();

    if (
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare(data))
    ) {
      try {
        await navigator.share(data);
      } catch (error) {
        // Closing the share sheet is not an error.
        if ((error as DOMException).name !== 'AbortError') await this.copy(url);
      }
      return;
    }
    await this.copy(url);
  }

  private url(): string {
    const params = new URLSearchParams(this.query());
    const query = params.toString();
    return this.seo.absolute(this.path()) + (query ? `?${query}` : '');
  }

  private async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(this.transloco.translate('common.linkCopied'));
    } catch {
      this.toast.error(this.transloco.translate('common.shareFailed'));
    }
  }
}
