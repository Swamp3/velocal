export interface User {
  id: string;
  email: string;
  displayName?: string;
  homeZip?: string;
  homeCountry?: string;
  preferredLanguage: string;
  preferredLocale: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
  hasPassword?: boolean;
}
