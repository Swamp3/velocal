import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const DISMISSED_KEY = 'velocal.installPrompt.dismissedAt';
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 15 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Offers to install the app. Chromium browsers fire `beforeinstallprompt`, which is kept
 * and replayed from our own banner. iOS Safari has no such event, so the banner explains
 * "Share → Add to Home Screen" there. Never shown inside the installed app, and after a
 * dismissal it stays quiet for 30 days.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private deferred?: BeforeInstallPromptEvent;
  private readonly ready = signal(false);
  private readonly hasNativePrompt = signal(false);
  private readonly snoozed = signal(false);
  private readonly installed = signal(false);

  readonly isIos = signal(false);
  /** True when the banner should be visible. */
  readonly visible = computed(
    () =>
      this.ready() &&
      !this.snoozed() &&
      !this.installed() &&
      (this.hasNativePrompt() || this.isIos()),
  );

  start(): void {
    if (!this.isBrowser) return;
    if (this.isStandalone()) {
      this.installed.set(true);
      return;
    }
    this.snoozed.set(this.recentlyDismissed());
    const ua = navigator.userAgent;
    const iosSafari =
      /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    this.isIos.set(iosSafari);

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.hasNativePrompt.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.installed.set(true);
      this.deferred = undefined;
    });
    // Do not greet a first-time visitor immediately.
    setTimeout(() => this.ready.set(true), SHOW_AFTER_MS);
  }

  async install(): Promise<void> {
    const event = this.deferred;
    if (!event) return;
    this.deferred = undefined;
    this.hasNativePrompt.set(false);
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'dismissed') this.dismiss();
  }

  dismiss(): void {
    this.snoozed.set(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private mode: the banner just returns on the next visit.
    }
  }

  private recentlyDismissed(): boolean {
    try {
      const at = Number(localStorage.getItem(DISMISSED_KEY));
      return at > 0 && Date.now() - at < SNOOZE_MS;
    } catch {
      return false;
    }
  }

  private isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }
}
