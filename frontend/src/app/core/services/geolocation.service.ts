import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

export interface ReverseGeocodeResult {
  zip?: string;
  country?: string;
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly http = inject(HttpClient);

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

  reverseGeocode(lat: number, lng: number): Observable<ReverseGeocodeResult> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`;
    return this.http
      .get<{ address?: { postcode?: string; country_code?: string } }>(url, {
        headers: { 'Accept-Language': 'en' },
      })
      .pipe(
        map((res) => ({
          zip: res.address?.postcode,
          country: res.address?.country_code?.toUpperCase(),
        })),
        catchError(() => of({})),
      );
  }
}
