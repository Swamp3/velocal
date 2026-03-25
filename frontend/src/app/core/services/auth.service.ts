import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '@shared/models';

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

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', { email, password }).pipe(
      tap((res) => this.setSession(res)),
    );
  }

  register(data: RegisterDto): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', data).pipe(
      tap((res) => this.setSession(res)),
    );
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

  private restoreSession(): void {
    const token = this.getToken();
    if (!token) return;

    this.api.get<User>('/users/me').subscribe({
      next: (user) => this._currentUser.set(user),
      error: () => this.logout(),
    });
  }
}
