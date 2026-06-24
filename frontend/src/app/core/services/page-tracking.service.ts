import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, filter, pairwise, startWith, switchMap, throttleTime } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PageTrackingService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
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
          return this.api.post('/analytics/page-view', { path: event.urlAfterRedirects });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => {} });
  }
}
