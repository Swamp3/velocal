import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

const STORAGE_KEY = 'velocal-discipline-filter';

@Injectable({ providedIn: 'root' })
export class FilterStateService {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _override = signal<string[] | null>(null);
  private readonly _userPrefs = signal<string[]>([]);

  readonly selectedDisciplines = computed(() => this._override() ?? this._userPrefs());

  constructor() {
    this.loadFromStorage();

    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.userService.getDisciplinePrefs().subscribe({
          next: (slugs) => {
            this._userPrefs.set(slugs);
            if (this._override() === null) {
              this.persistToStorage(slugs);
            }
          },
        });
      }
    });

    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this._userPrefs.set([]);
        this._override.set(null);
        this.loadFromStorage();
      }
    });
  }

  setDisciplines(slugs: string[]): void {
    this._override.set(slugs);
    this.persistToStorage(slugs);
  }

  clearOverride(): void {
    this._override.set(null);
  }

  /** Called when user saves discipline prefs in profile — sync both layers. */
  onUserPrefsSaved(slugs: string[]): void {
    this._userPrefs.set(slugs);
    if (this._override() !== null) {
      this._override.set(slugs);
    }
    this.persistToStorage(slugs);
  }

  private loadFromStorage(): void {
    if (!this.isBrowser) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this._userPrefs.set(parsed);
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private persistToStorage(slugs: string[]): void {
    if (!this.isBrowser) return;
    if (slugs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
