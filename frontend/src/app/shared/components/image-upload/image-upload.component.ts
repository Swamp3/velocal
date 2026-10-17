import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonComponent, ToastService } from '@shared/ui';
import { Observable } from 'rxjs';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Renders a drop-zone / file-input that previews the selected image, uploads
 * it via a caller-supplied observable factory, and emits the resulting URL.
 *
 * The component intentionally doesn't know about specific subjects — the host
 * form decides what endpoint to hit. That keeps it reusable for events,
 * series, and posts without dragging each feature's service in here.
 */
/** Status and server text of a failed request, so a report says what actually happened. */
function errorDetail(err: unknown): string {
  // UploadService turns HTTP errors into a plain `{ status, message }`.
  const e = err as { status?: unknown; message?: unknown; error?: { message?: unknown } };
  if (typeof e?.status !== 'number') return '';
  const raw = e.error?.message ?? e.message;
  const text = typeof raw === 'string' && raw ? `: ${raw.slice(0, 120)}` : '';
  return ` (HTTP ${e.status}${text})`;
}

@Component({
  selector: 'app-image-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslocoPipe],
  templateUrl: './image-upload.component.html',
})
export class ImageUploadComponent {
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  /** Current persisted image URL (null → show empty state). */
  readonly imageUrl = input<string | null | undefined>(null);

  /** Disables all controls (e.g. while the parent form is saving). */
  readonly disabled = input(false);

  /**
   * Caller-supplied factories. We accept the observable factory rather than
   * the raw result so we can control the `loading` signal from inside the
   * component without the caller needing to thread it back.
   */
  readonly uploadFn = input.required<(file: File) => Observable<{ imageUrl?: string | null }>>();
  readonly deleteFn = input<(() => Observable<{ imageUrl?: string | null }>) | null>(null);

  readonly imageChange = output<string | null>();

  protected readonly accept = ACCEPTED;
  protected readonly loading = signal(false);
  protected readonly dragging = signal(false);
  protected readonly preview = signal<string | null>(null);

  /**
   * What the UI actually shows: the in-memory preview (from the File the user
   * just picked, before upload completes) wins over the persisted server URL.
   */
  protected readonly displayUrl = computed(() => this.preview() ?? this.imageUrl() ?? null);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.handleFile(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled() || this.loading()) return;
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled() || this.loading()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.handleFile(file);
  }

  protected async remove(): Promise<void> {
    const fn = this.deleteFn();
    if (!fn || this.loading() || this.disabled()) return;

    this.loading.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        fn().subscribe({
          next: () => {
            this.preview.set(null);
            this.imageChange.emit(null);
            resolve();
          },
          error: reject,
        });
      });
    } catch (err) {
      this.toast.error(this.transloco.translate('uploads.failed') + errorDetail(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async handleFile(file: File): Promise<void> {
    if (!this.validate(file)) return;

    // Show an immediate preview from the raw File — this disappears as soon as
    // the server-side URL arrives and the `imageUrl` input updates.
    this.preview.set(URL.createObjectURL(file));
    this.loading.set(true);

    try {
      const result = await new Promise<{ imageUrl?: string | null }>((resolve, reject) => {
        this.uploadFn()(file).subscribe({ next: resolve, error: reject });
      });
      const next = result.imageUrl ?? null;
      this.preview.set(null);
      this.imageChange.emit(next);
      this.toast.success(this.transloco.translate('uploads.updated'));
    } catch (err) {
      this.preview.set(null);
      this.toast.error(this.transloco.translate('uploads.failed') + errorDetail(err));
    } finally {
      this.loading.set(false);
    }
  }

  private validate(file: File): boolean {
    if (!ACCEPTED.split(',').includes(file.type)) {
      this.toast.error(this.transloco.translate('uploads.type'));
      return false;
    }
    if (file.size > MAX_BYTES) {
      this.toast.error(this.transloco.translate('uploads.size'));
      return false;
    }
    return true;
  }
}
