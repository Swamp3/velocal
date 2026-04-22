import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, REQUEST, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'velocal-theme';
/** One year — browsers cap cookies at 400d so this gets clamped but that's fine. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  /** Populated during SSR, `null` in the browser. */
  private readonly request = inject(REQUEST, { optional: true });

  readonly theme = signal<Theme>(this.resolve());

  constructor() {
    effect(() => {
      const t = this.theme();
      this.doc.documentElement.classList.toggle('dark', t === 'dark');
      if (this.isBrowser) {
        localStorage.setItem(STORAGE_KEY, t);
        this.doc.cookie = `${STORAGE_KEY}=${t}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private resolve(): Theme {
    if (this.isBrowser) {
      const stored = (localStorage.getItem(STORAGE_KEY) ?? this.readCookie(this.doc.cookie)) as
        | Theme
        | null
        | undefined;
      if (stored === 'dark' || stored === 'light') return stored;
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      return 'dark';
    }

    // SSR: read the theme cookie from the inbound request so users with a stored
    // preference don't get a FOUC on hydration.
    const cookieHeader = this.request?.headers.get('cookie') ?? '';
    const cookieTheme = this.readCookie(cookieHeader);
    if (cookieTheme === 'dark' || cookieTheme === 'light') return cookieTheme;
    return 'dark';
  }

  private readCookie(header: string): Theme | null {
    if (!header) return null;
    for (const part of header.split(';')) {
      const [rawKey, ...rest] = part.split('=');
      if (rawKey?.trim() === STORAGE_KEY) {
        const value = rest.join('=').trim();
        if (value === 'dark' || value === 'light') return value;
      }
    }
    return null;
  }
}
