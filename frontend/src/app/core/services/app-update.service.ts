import { isPlatformBrowser } from '@angular/common';
import { ApplicationRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, first, interval } from 'rxjs';
import { filter } from 'rxjs/operators';
import { isChunkLoadError } from '@shared/utils/chunk-error';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const RELOAD_KEY = 'velocal-chunk-reload';
/** A second failed page load within this time is not retried, so a real outage cannot loop. */
const RELOAD_GUARD_MS = 30_000;

/**
 * Notices new deployments through the Angular service worker.
 * - A new version is downloaded in the background and `updateReady` turns true,
 *   which shows the "new version" banner.
 * - On the next in-app navigation the update is applied automatically (the page
 *   is replaced anyway, so no half-typed form is lost); the banner button
 *   applies it immediately.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sw = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);
  private readonly router = inject(Router);

  readonly updateReady = signal(false);

  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // A page opened before a deployment cannot fetch the new page's script any more. Load the
    // address that was meant instead of staying on the old page.
    this.router.events
      .pipe(filter((event): event is NavigationError => event instanceof NavigationError))
      .subscribe((event) => {
        if (isChunkLoadError(event.error)) void this.reloadTo(event.url);
      });

    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));

    // The cached app can break after a deployment; reload to recover.
    this.sw.unrecoverable.subscribe(() => document.location.reload());

    // Apply a ready update on the next navigation.
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (this.updateReady()) void this.apply();
    });

    // Look for a new version regularly, once the app is stable (so the check
    // does not keep Angular from becoming stable), and when the tab returns.
    const stable = this.appRef.isStable.pipe(first((isStable) => isStable));
    concat(stable, interval(CHECK_EVERY_MS)).subscribe(() => void this.check());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check();
    });
  }

  async apply(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      document.location.reload();
    }
  }

  private async reloadTo(url: string): Promise<void> {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < RELOAD_GUARD_MS) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // Storage blocked: reload anyway, the browser limits repeated failures itself.
    }
    try {
      if (this.sw.isEnabled) await this.sw.activateUpdate();
    } catch {
      // No update to activate.
    } finally {
      window.location.assign(url);
    }
  }

  private async check(): Promise<void> {
    try {
      await this.sw.checkForUpdate();
    } catch {
      // Offline or the server is restarting; the next check will retry.
    }
  }
}
