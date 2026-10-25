import type { LicenseClass } from './event.model';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  stravaUrl?: string | null;
  homeZip?: string;
  homeCountry?: string;
  preferredLanguage: string;
  preferredLocale: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
  hasPassword?: boolean;
  /** Rider data, only used for the "fits me" class filter. */
  birthYear?: number | null;
  gender?: RiderGender | null;
  licenseType?: RiderLicense | null;
  licenseClass?: LicenseClass | null;
}

export type RiderGender = 'male' | 'female' | 'diverse';
/** none: no licence (Hobby/Jedermann); license: federation licence (BDR); uci: UCI licence. */
export type RiderLicense = 'none' | 'license' | 'uci';
