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
}
