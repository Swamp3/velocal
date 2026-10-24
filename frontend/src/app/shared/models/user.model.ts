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
}

export type RiderGender = 'male' | 'female' | 'diverse';
export type RiderLicense = 'none' | 'hobby' | 'license';
