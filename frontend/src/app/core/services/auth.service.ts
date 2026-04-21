import { computed, inject, Injectable, signal } from '@angular/core';
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
  private readonly _currentUser = signal<User | null>(null);
  private readonly _initialized = signal(false);
  private readonly _initPromise: Promise<void>;

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly initialized = this._initialized.asReadonly();

  constructor() {
    this._initPromise = this.restoreSession();
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

  updateCurrentUser(user: User): void {
    this._currentUser.set(user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this._currentUser.set(res.user);
  }

  /** Uses native fetch to bypass HttpClient interceptors during APP_INITIALIZER. */
  private async restoreSession(): Promise<void> {
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
