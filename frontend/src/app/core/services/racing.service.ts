import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { RacingMeta } from '@shared/models';
import { ApiService } from './api.service';

/** Value lists of events (categories, licences, formats, parking kinds …), loaded once from the API. */
@Injectable({ providedIn: 'root' })
export class RacingService {
  private readonly api = inject(ApiService);

  readonly meta = toSignal(this.api.get<RacingMeta>('/events/meta'), { initialValue: null });

  readonly formats = computed(() => this.meta()?.formats.map((f) => f.key) ?? []);
  readonly categories = computed(() => this.meta()?.categories ?? []);
  readonly classLicenses = computed(() => this.meta()?.classLicenses ?? []);
  readonly licenseClasses = computed(() => this.meta()?.licenseClasses.map((c) => c.key) ?? []);
  readonly championshipLevels = computed(() => this.meta()?.championshipLevels ?? []);
  readonly parkingKinds = computed(() => this.meta()?.parkingKinds ?? []);
  readonly parkingFees = computed(() => this.meta()?.parkingFees ?? []);
  readonly maxParkingAreas = computed(() => this.meta()?.maxParkingAreas ?? 0);

  /** Touring formats (RTF, CTF …) have routes instead of rating classes. */
  isTouring(format: string | null | undefined): boolean {
    return !!format && !!this.meta()?.formats.some((f) => f.key === format && f.touring);
  }

  /** Category key of a rider of this age (age reached in the calendar year). */
  categoryForAge(age: number): string | null {
    return (
      this.categories().find(
        (c) => (c.ageMin == null || age >= c.ageMin) && (c.ageMax == null || age <= c.ageMax),
      )?.key ?? null
    );
  }

  /** Licence classes a licensed rider of this age can hold (all when the age is unknown). */
  licenseClassesForAge(age: number | null): string[] {
    return (this.meta()?.licenseClasses ?? [])
      .filter((c) => age == null || age >= c.minAge)
      .map((c) => c.key);
  }
}
