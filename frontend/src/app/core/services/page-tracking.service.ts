import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { API_BASE_URL } from '@core/tokens/api-base-url';
import { catchError, EMPTY, filter, pairwise, startWith, switchMap, throttleTime } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PageTrackingService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly destroyRef = inject(DestroyRef);

  init(): void {
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
            .post(`${this.base}/analytics/page-view`, { path: event.urlAfterRedirects }, { responseType: 'text' })
            .pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
