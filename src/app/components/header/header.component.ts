import { Component, HostListener, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="site-header social-navbar" [class.scrolled]="scrolled()">
      <div class="nav-brand-zone">
        <a routerLink="/" class="brand brand-logo" aria-label="ColdMovie მთავარი">
          <img src="/coldmovie-logo.svg" alt="ColdMovie" />
        </a>
      </div>

      <button class="icon-btn mobile-only nav-menu-toggle" type="button" (click)="toggleMenu()" aria-label="მენიუს გახსნა">☰</button>

      <nav class="nav-center-pill" [class.open]="menuOpen()" aria-label="მთავარი ნავიგაცია">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <span>⌂</span>
          მთავარი
        </a>
        <a routerLink="/movies" routerLinkActive="active">
          <span>▶</span>
          ფილმები
        </a>
        <a routerLink="/series" routerLinkActive="active">
          <span>TV</span>
          სერიალები
        </a>
        <a routerLink="/reels" routerLinkActive="active">
          <span>▮</span>
          რილსები
        </a>
      </nav>

      <div class="header-actions nav-action-zone">
        @if (searchOpen()) {
          <form class="header-search nav-search" (submit)="submitSearch($event)">
            <input name="query" [(ngModel)]="query" placeholder="მოძებნე მომხმარებელი" aria-label="მომხმარებლის ძებნა" />
          </form>
        }

        <button class="icon-btn" type="button" (click)="searchOpen.set(!searchOpen())" aria-label="ძიება" title="ძიება">⌕</button>
        <a class="icon-link" routerLink="/favorites" routerLinkActive="active" aria-label="ფავორიტები" title="ფავორიტები">♥</a>
        <a class="icon-link" routerLink="/watchlist" routerLinkActive="active" aria-label="სანახავი" title="სანახავი">＋</a>
        <button
          class="icon-btn theme-toggle"
          [class.is-light]="theme.isLight()"
          type="button"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.isLight() ? 'ბნელ რეჟიმზე გადართვა' : 'ნათელ რეჟიმზე გადართვა'"
          [title]="theme.isLight() ? 'ბნელი რეჟიმი' : 'ნათელი რეჟიმი'"
        >
          <span class="theme-toggle-track" aria-hidden="true">
            <span class="theme-toggle-orb">
              <span class="theme-sun">☀</span>
              <span class="theme-moon">☾</span>
            </span>
          </span>
        </button>

        <div class="auth-menu">
          <button
            class="profile-icon"
            [class.has-avatar]="!!auth.currentUser()?.avatarUrl"
            type="button"
            (click)="profileOpen.set(!profileOpen())"
            aria-label="პროფილი"
          >
            @if (auth.currentUser(); as user) {
              @if (user.avatarUrl) {
                <img [src]="user.avatarUrl" [alt]="user.name" />
              } @else {
                <span>{{ initials(user.name) }}</span>
              }
            } @else {
              <span>CM</span>
            }
          </button>

          @if (profileOpen()) {
            <div class="profile-popover">
              @if (auth.currentUser(); as user) {
                <div class="popover-user">
                  <div class="popover-avatar">
                    @if (user.avatarUrl) {
                      <img [src]="user.avatarUrl" [alt]="user.name" />
                    } @else {
                      <span>{{ initials(user.name) }}</span>
                    }
                  </div>
                  <div>
                    <strong>{{ user.name }}</strong>
                    <span>{{ user.email }}</span>
                  </div>
                </div>
                <button type="button" (click)="goPublicProfile(user.id)">ჩემი გვერდი</button>
                <button type="button" (click)="goProfile()">პროფილის პარამეტრები</button>
                @if (auth.isAdmin()) {
                  <button type="button" (click)="goAdmin()">ადმინ პანელი</button>
                }
                <button type="button" (click)="logout()">გასვლა</button>
              } @else {
                <button type="button" (click)="openAuth('login')">შესვლა</button>
                <button type="button" (click)="openAuth('register')">რეგისტრაცია</button>
              }
            </div>
          }
        </div>
      </div>

      @if (searchOpen()) {
        <form class="header-search nav-search-panel" (submit)="submitSearch($event)">
          <input name="query" [(ngModel)]="query" placeholder="Search users" aria-label="User search" />
          <button class="btn" type="submit">Search</button>
        </form>
      }
    </header>
  `,
})
export class HeaderComponent {
  readonly menuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly profileOpen = signal(false);
  readonly scrolled = signal(false);
  query = '';

  constructor(
    private readonly router: Router,
    readonly auth: AuthService,
    readonly theme: ThemeService,
  ) {}

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  submitSearch(event?: Event): void {
    event?.preventDefault();
    const trimmed = this.query.trim();
    if (!trimmed) {
      return;
    }

    void this.router.navigate(['/search'], { queryParams: { q: trimmed } });
    this.searchOpen.set(false);
    this.menuOpen.set(false);
  }

  openAuth(mode: 'login' | 'register'): void {
    this.profileOpen.set(false);
    this.auth.open(mode);
  }

  goProfile(): void {
    this.profileOpen.set(false);
    void this.router.navigate(['/profile']);
  }

  goPublicProfile(userId: string): void {
    this.profileOpen.set(false);
    void this.router.navigate(['/users', userId]);
  }

  goAdmin(): void {
    this.profileOpen.set(false);
    void this.router.navigate(['/admin']);
  }

  logout(): void {
    this.profileOpen.set(false);
    this.auth.logout();
  }

  initials(name: string): string {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'CM'
    );
  }
}
