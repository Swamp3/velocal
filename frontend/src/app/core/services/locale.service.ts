import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, Injector, PLATFORM_ID, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const LANG_KEY = 'velocal-lang';
const LOCALE_KEY = 'velocal-locale';

export type SupportedLang = 'de' | 'en';
export type SupportedLocale = 'de' | 'en';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _language = signal<SupportedLang>(this.readStored(LANG_KEY, 'de'));
  private readonly _locale = signal<SupportedLocale>(this.readStored(LOCALE_KEY, 'de'));

  constructor() {
    this.syncHtmlLang(this._locale());
  }

  readonly language = this._language.asReadonly();
  readonly locale = this._locale.asReadonly();

  /**
   * Full locale string for Intl APIs (e.g. 'de-DE', 'en-US').
   */
  readonly intlLocale = computed(() => (this._locale() === 'de' ? 'de-DE' : 'en-US'));

  /**
   * Set the UI language. Applies immediately via Transloco (no reload needed).
   */
  setLanguage(lang: SupportedLang, persist = true): void {
    this._language.set(lang);
    this.injector.get(TranslocoService).setActiveLang(lang);
    if (persist && this.isBrowser) {
      localStorage.setItem(LANG_KEY, lang);
    }
  }

  /**
   * Set the format locale. Since Angular's LOCALE_ID is static (set at bootstrap),
   * changing the format locale requires a page reload to take effect.
   * Returns `true` if a reload is needed.
   */
  setLocale(locale: SupportedLocale, persist = true): boolean {
    const changed = locale !== this._locale();
    this._locale.set(locale);
    this.syncHtmlLang(locale);
    if (persist && this.isBrowser) {
      localStorage.setItem(LOCALE_KEY, locale);
    }
    return changed;
  }

  /**
   * Apply preferences from a user object (e.g. after login or session restore).
   * Returns true if a reload is needed (locale format changed).
   */
  applyUserPreferences(prefs: { preferredLanguage: string; preferredLocale: string }): boolean {
    const lang = this.validLang(prefs.preferredLanguage);
    const locale = this.validLocale(prefs.preferredLocale);

    this.setLanguage(lang);
    return this.setLocale(locale);
  }

  /**
   * Sync `<html lang="...">` so native inputs (datetime-local, etc.) match the format locale.
   */
  private syncHtmlLang(locale: SupportedLocale): void {
    this.document.documentElement.lang = locale;
  }

  private readStored(key: string, fallback: string): SupportedLang {
    if (!this.isBrowser) return fallback as SupportedLang;
    const stored = localStorage.getItem(key);
    if (stored === 'de' || stored === 'en') return stored;
    return fallback as SupportedLang;
  }

  private validLang(v: string): SupportedLang {
    return v === 'en' ? 'en' : 'de';
  }

  private validLocale(v: string): SupportedLocale {
    return v === 'en' ? 'en' : 'de';
  }
}

/** Reads the stored UI language from localStorage (SSR-safe). */
export function storedLang(): 'de' | 'en' {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'en') return 'en';
  }
  return 'de';
}

/** Factory for Angular's LOCALE_ID — reads from localStorage at bootstrap time. */
export function localeIdFactory(): string {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'en') {
      if (typeof document !== 'undefined') document.documentElement.lang = 'en';
      return 'en';
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = 'de';
  return 'de';
}
