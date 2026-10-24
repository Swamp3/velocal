import type { ClassLicense, EventClass, RiderGender, RiderLicense } from '@shared/models';

const LICENSE_RANK: Record<ClassLicense, number> = { none: 0, hobby: 1, license: 2 };

export interface Rider {
  birthYear?: number | null;
  gender?: RiderGender | null;
  licenseType?: RiderLicense | null;
}

/**
 * Whether a rider may start in a class (same rule as the server's "fits me" filter). Ages count by
 * year of birth; unknown profile data does not exclude a class; "diverse" may start anywhere.
 */
export function classFits(cls: EventClass, rider: Rider, eventYear: number): boolean {
  if (rider.birthYear) {
    const age = eventYear - rider.birthYear;
    if (cls.ageMin != null && age < cls.ageMin) return false;
    if (cls.ageMax != null && age > cls.ageMax) return false;
  }
  if (cls.gender !== 'open' && (rider.gender === 'male' || rider.gender === 'female')) {
    if (cls.gender !== rider.gender) return false;
  }
  if (rider.licenseType && LICENSE_RANK[cls.license] > LICENSE_RANK[rider.licenseType]) return false;
  return true;
}

/** Years of birth a class is for, e.g. `2012–2013`, `2007 and older`, or null for all ages. */
export function birthYears(
  cls: Pick<EventClass, 'ageMin' | 'ageMax'>,
  eventYear: number,
): { from: number | null; to: number | null } | null {
  if (cls.ageMin == null && cls.ageMax == null) return null;
  return {
    from: cls.ageMax != null ? eventYear - cls.ageMax : null,
    to: cls.ageMin != null ? eventYear - cls.ageMin : null,
  };
}

/** The rider gave anything the filter can use. */
export function hasRiderData(rider: Rider | null | undefined): boolean {
  return !!rider && (!!rider.birthYear || !!rider.gender || !!rider.licenseType);
}
