import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly loading = signal(false);
  readonly denied = signal(false);

  getCurrentPosition(): Observable<GeolocationPosition> {
    return new Observable((subscriber) => {
      if (!navigator.geolocation) {
        subscriber.error(new Error('Geolocation not supported'));
        return;
      }

      this.loading.set(true);
      this.denied.set(false);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.loading.set(false);
          subscriber.next(pos);
          subscriber.complete();
        },
        (err) => {
          this.loading.set(false);
          if (err.code === err.PERMISSION_DENIED) {
            this.denied.set(true);
          }
          subscriber.error(err);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
      );
    });
  }
}
