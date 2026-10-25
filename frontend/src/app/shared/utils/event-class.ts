import type { EventClass, LicenseClass, RiderGender, RiderLicense } from '@shared/models';

export interface Rider {
  birthYear?: number | null;
  gender?: RiderGender | null;
  licenseType?: RiderLicense | null;
  licenseClass?: LicenseClass | null;
}

/**
 * Age categories of German Cycling (same as the server). The age is the age reached in the
 * calendar year; from 30 a licensed rider may choose Masters instead of Elite.
 */
export const RIDER_CATEGORIES: readonly { key: string; ageMin: number | null; ageMax: number | null }[] = [
  { key: 'u11', ageMin: null, ageMax: 10 },
  { key: 'u13', ageMin: 11, ageMax: 12 },
  { key: 'u15', ageMin: 13, ageMax: 14 },
  { key: 'u17', ageMin: 15, ageMax: 16 },
  { key: 'u19', ageMin: 17, ageMax: 18 },
  { key: 'u23', ageMin: 19, ageMax: 22 },
  { key: 'elite', ageMin: 23, ageMax: 29 },
  { key: 'masters1', ageMin: 30, ageMax: 39 },
  { key: 'masters2', ageMin: 40, ageMax: 49 },
  { key: 'masters3', ageMin: 50, ageMax: 59 },
  { key: 'masters4', ageMin: 60, ageMax: null },
];

/** Category key of a rider of this age. */
export function categoryForAge(age: number): string {
  return (
    RIDER_CATEGORIES.find(
      (c) => (c.ageMin == null || age >= c.ageMin) && (c.ageMax == null || age <= c.ageMax),
    ) ?? RIDER_CATEGORIES[0]
  ).key;
}

/**
 * Licence classes a licensed rider of this age can hold: none below 19 (youth licence), Elite
 * Amateur or Amateur from 19, Masters as a further choice from 30.
 */
export function licenseClassesForAge(age: number | null): LicenseClass[] {
  if (age == null) return ['elite_amateur', 'amateur', 'master'];
  if (age < 19) return [];
  return age >= 30 ? ['elite_amateur', 'amateur', 'master'] : ['elite_amateur', 'amateur'];
}

/**
 * Whether a rider may start in a class (same rule as the server's "fits me" filter). Ages count by
 * year of birth; unknown profile data does not exclude a class; "diverse" may start anywhere.
 * Hobby classes are only for riders without licence; licence classes need a licence unless they
 * allow a day licence; UCI classes need a UCI licence.
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
  const licensed = rider.licenseType === 'license' || rider.licenseType === 'uci';
  if (rider.licenseType) {
    if (cls.license === 'unlicensed' && licensed) return false;
    if (cls.license === 'license' && !licensed && !cls.dayLicense) return false;
    if (cls.license === 'uci' && rider.licenseType !== 'uci') return false;
  }
  if (
    licensed &&
    rider.licenseClass &&
    cls.licenseClasses?.length &&
    !cls.licenseClasses.includes(rider.licenseClass)
  ) {
    return false;
  }
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
