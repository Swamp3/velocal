import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'ui-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);

  protected readonly typeClasses: Record<string, string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-[var(--color-primary)] text-white',
  };
}
