import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { API_BASE_URL } from '@core/tokens/api-base-url';
import { catchError, EMPTY, filter, pairwise, startWith, switchMap, throttleTime } from 'rxjs';

/** Older versions stored a persistent id here; it is removed on start. */
const LEGACY_CLIENT_ID_KEY = 'velocal_client_id';

@Injectable({ providedIn: 'root' })
export class PageTrackingService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  init(): void {
    if (!this.isBrowser) return;

    this.removeLegacyClientId();
    // Lives only in memory: a new id per visit (page load), never written to
    // cookies or local storage, so nothing is stored on the device.
    const clientId = crypto.randomUUID();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        startWith(null),
        pairwise(),
        filter(([prev, curr]) => prev?.urlAfterRedirects !== curr!.urlAfterRedirects),
        throttleTime(1000),
        switchMap(([, event]) => {
          if (!event) return EMPTY;
          return this.http
            .post(
              `${this.base}/analytics/page-view`,
              { path: event.urlAfterRedirects, clientId },
              { responseType: 'text' },
            )
            .pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private removeLegacyClientId(): void {
    try {
      localStorage.removeItem(LEGACY_CLIENT_ID_KEY);
    } catch {
      // storage blocked: nothing to remove
    }
  }
}
