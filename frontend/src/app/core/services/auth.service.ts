import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { environment } from '@env';
import { User } from '@shared/models';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

const TOKEN_KEY = 'velocal-token';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _currentUser = signal<User | null>(null);
  private readonly _initialized = signal(false);
  /**
   * `false` on both server and the first browser tick so SSR output matches the
   * initial client render (prevents hydration mismatch warnings for auth-bound chrome).
   * Flipped to `true` in `afterNextRender`, after hydration completes.
   */
  private readonly _hydrated = signal(false);
  private readonly _initPromise: Promise<void>;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly initialized = this._initialized.asReadonly();
  readonly hydrated = this._hydrated.asReadonly();

  constructor() {
    this._initPromise = this.restoreSession();
    if (this.isBrowser) {
      afterNextRender(() => this._hydrated.set(true));
    } else {
      this._hydrated.set(true);
    }
  }

  whenReady(): Promise<void> {
    return this._initPromise;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/login', { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  register(data: RegisterDto): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/register', data)
      .pipe(tap((res) => this.setSession(res)));
  }

  requestOtp(email: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/request-otp', { email });
  }

  verifyOtp(email: string, code: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/verify-otp', { email, code }).pipe(
      tap((res) => this.setSession(res)),
    );
  }

  updateCurrentUser(user: User): void {
    this._currentUser.set(user);
  }

  logout(): void {
    if (this.isBrowser) localStorage.removeItem(TOKEN_KEY);
    this._currentUser.set(null);
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private setSession(res: AuthResponse): void {
    if (this.isBrowser) localStorage.setItem(TOKEN_KEY, res.accessToken);
    this._currentUser.set(res.user);
  }

  /** Uses native fetch to bypass HttpClient interceptors during APP_INITIALIZER. */
  private async restoreSession(): Promise<void> {
    // TODO(ssr-auth): once we migrate the token into an httpOnly cookie, the SSR
    // branch can forward the `Cookie` header to `/auth/me` and render authenticated
    // HTML. While the token lives in localStorage only, SSR is always anonymous and
    // the `hydrated` gate below keeps auth-bound UI from flashing / mismatching.
    if (!this.isBrowser) {
      this._initialized.set(true);
      return;
    }

    const token = this.getToken();
    if (!token) {
      this._initialized.set(true);
      return;
    }

    try {
      const res = await fetch(`${environment.apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        this.logout();
        return;
      }

      const user: User = await res.json();
      this._currentUser.set(user);
    } catch {
      this.logout();
    } finally {
      this._initialized.set(true);
    }
  }
}
