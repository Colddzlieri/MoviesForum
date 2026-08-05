import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { LocalStorageService } from './local-storage.service';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  bannerUrl?: string;
  role?: 'user' | 'admin';
}

type AuthMode = 'login' | 'register';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(LocalStorageService);
  private readonly http = inject(HttpClient);
  private readonly userStore = this.storage.createSignal<AppUser | null>('ColdMovie:authUser', null);
  private readonly tokenStore = this.storage.createSignal<string | null>('ColdMovie:authToken', null);
  private readonly modalState = signal<AuthMode | null>(null);

  readonly modalMode = this.modalState.asReadonly();
  readonly currentUser = computed<AppUser | null>(() => this.userStore.state());
  readonly isLoggedIn = computed(() => Boolean(this.currentUser() && this.tokenStore.state()));
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly allUsers = computed<AppUser[]>(() => (this.currentUser() ? [this.currentUser() as AppUser] : []));

  constructor() {
    if (this.tokenStore.state()) {
      this.http.get<{ user: AppUser }>('/api/auth/me', { headers: this.authHeaders() }).subscribe({
        next: (response) => this.userStore.set(response.user),
        error: () => this.logout(),
      });
    }
  }

  token(): string | null {
    return this.tokenStore.state();
  }

  authHeaders(): Record<string, string> {
    const token = this.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  open(mode: AuthMode = 'login'): void {
    this.modalState.set(mode);
    document.body.classList.add('modal-open');
  }

  close(): void {
    this.modalState.set(null);
    document.body.classList.remove('modal-open');
  }

  register(name: string, email: string, password: string, avatarUrl?: string): Observable<string | null> {
    return this.http
      .post<{ user: AppUser; token: string }>('/api/auth/register', {
        name,
        email,
        password,
        avatarUrl,
      })
      .pipe(
        tap((response) => this.setSession(response.user, response.token)),
        map(() => null),
        catchError((error) => of(error.error?.message || 'რეგისტრაცია ვერ შესრულდა.')),
      );
  }

  login(email: string, password: string): Observable<string | null> {
    return this.http
      .post<{ user: AppUser; token: string }>('/api/auth/login', {
        email,
        password,
      })
      .pipe(
        tap((response) => this.setSession(response.user, response.token)),
        map(() => null),
        catchError((error) => of(error.error?.message || 'ელფოსტა ან პაროლი არასწორია.')),
      );
  }

  logout(): void {
    this.tokenStore.set(null);
    this.userStore.set(null);
  }

  updateProfile(name: string, email: string): Observable<string | null> {
    const current = this.currentUser();
    if (!current) {
      this.open('login');
      return of('პროფილის შესაცვლელად შედი ანგარიშში.');
    }
    return this.patchProfile({ name: name.trim(), email: email.trim().toLowerCase() });
  }

  updateAvatar(avatarUrl: string | null): Observable<string | null> {
    const current = this.currentUser();
    if (!current) {
      this.open('login');
      return of('ფოტოს შესაცვლელად შედი ანგარიშში.');
    }
    return this.patchProfile({ avatarUrl: avatarUrl ?? '' });
  }

  updateBanner(bannerUrl: string | null): Observable<string | null> {
    const current = this.currentUser();
    if (!current) {
      this.open('login');
      return of('ბანერის შესაცვლელად შედი ანგარიშში.');
    }
    return this.patchProfile({ bannerUrl: bannerUrl ?? '' });
  }

  updatePassword(_currentPassword: string, _nextPassword: string): string | null {
    if (!this.currentUser()) {
      this.open('login');
      return 'პაროლის შესაცვლელად შედი ანგარიშში.';
    }
    return 'პაროლის ცვლილება სერვერის ანგარიშის სისტემით იმართება.';
  }

  deleteAccount(): void {
    this.logout();
  }

  requireLogin(): boolean {
    if (this.isLoggedIn()) {
      return true;
    }

    this.open('login');
    return false;
  }

  private setSession(user: AppUser, token: string): void {
    this.userStore.set(user);
    this.tokenStore.set(token);
    this.close();
  }

  private patchProfile(payload: Partial<Pick<AppUser, 'name' | 'email' | 'avatarUrl' | 'bannerUrl'>>): Observable<string | null> {
    return this.http.patch<{ user: AppUser }>('/api/auth/profile', payload, { headers: this.authHeaders() }).pipe(
      tap((response) => this.userStore.set(response.user)),
      map(() => null),
      catchError((error) => of(error.error?.message || 'პროფილის შენახვა ვერ მოხერხდა.')),
    );
  }
}
