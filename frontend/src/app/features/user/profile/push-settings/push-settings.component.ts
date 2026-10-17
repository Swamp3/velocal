import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PushCategory, PushPreferences, PushService } from '@core/services/push.service';
import { ButtonComponent, ToastService } from '@shared/ui';
import { ProfileSectionComponent } from '../profile-section.component';

const CATEGORIES: PushCategory[] = ['invites', 'membership', 'events', 'community'];

/** Profile section: turn push on for this device and choose which messages arrive. */
@Component({
  selector: 'app-push-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, ButtonComponent, ProfileSectionComponent],
  host: { class: 'block' },
  templateUrl: './push-settings.component.html',
})
export class PushSettingsComponent implements OnInit {
  protected readonly push = inject(PushService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly categories = CATEGORIES;
  protected readonly prefs = signal<PushPreferences | null>(null);
  protected readonly busy = signal(false);
  protected readonly testing = signal(false);

  ngOnInit(): void {
    void this.push.refresh();
    this.push.getPreferences().subscribe({ next: (p) => this.prefs.set(p) });
  }

  protected async toggleDevice(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    if (this.push.state() === 'on') {
      await this.push.disable();
    } else {
      const ok = await this.push.enable();
      if (!ok && this.push.state() !== 'denied') {
        this.toast.error(this.transloco.translate('profile.push.enableFailed'));
      }
    }
    this.busy.set(false);
  }

  protected toggleCategory(category: PushCategory): void {
    const current = this.prefs();
    if (!current) return;
    const value = !current[category];
    this.prefs.set({ ...current, [category]: value });
    this.push.updatePreferences({ [category]: value }).subscribe({
      next: (p) => this.prefs.set(p),
      error: () => {
        this.prefs.set(current);
        this.toast.error(this.transloco.translate('profile.prefsError'));
      },
    });
  }

  protected sendTest(): void {
    if (this.testing()) return;
    this.testing.set(true);
    this.push.sendTest().subscribe({
      next: ({ sent }) => {
        this.testing.set(false);
        this.toast.success(
          this.transloco.translate(sent > 0 ? 'profile.push.testSent' : 'profile.push.testNone'),
        );
      },
      error: (err) => {
        this.testing.set(false);
        this.toast.error(
          this.transloco.translate(
            err.status === 429 ? 'profile.push.testWait' : 'profile.push.testFailed',
          ),
        );
      },
    });
  }
}
