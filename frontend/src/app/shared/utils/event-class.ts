import type { EventClass } from '@shared/models';

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
