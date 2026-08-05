import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { PublicUserSummary } from '../../core/models/post.models';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-search-page',
  imports: [DatePipe, FormsModule, RouterLink, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    <section class="user-search-page">
      <div class="user-search-hero">
        <span class="settings-kicker">ColdMovie People</span>
        <h1>მომხმარებლების ძებნა</h1>
        <p>მოძებნე მომხმარებელი სახელით, გახსენი პროფილი და ნახე მისი პოსტები და ფავორიტები.</p>
      </div>

      <section class="user-search-panel">
        <form class="user-search-form" (ngSubmit)="submit()">
          <label>
            <span>საძიებო სახელი</span>
            <input [(ngModel)]="queryValue" name="query" placeholder="ჩაწერე მომხმარებლის სახელი..." autocomplete="off" />
          </label>
          <button class="btn" type="submit">ძებნა</button>
        </form>

        @if (loading()) {
          <app-loading-skeleton [count]="6" />
        } @else if (filteredUsers().length) {
          <div class="user-search-grid">
            @for (user of filteredUsers(); track user.id) {
              <a class="user-result-card" [routerLink]="['/users', user.id]">
                <div class="user-result-cover">
                  @if (user.bannerUrl) {
                    <img [src]="user.bannerUrl" [alt]="user.name + ' ბანერი'" />
                  }
                </div>

                <div class="user-result-main">
                  <span class="user-result-avatar">
                    @if (user.avatarUrl) {
                      <img [src]="user.avatarUrl" [alt]="user.name" />
                    } @else {
                      {{ initials(user.name) }}
                    }
                  </span>

                  <div>
                    <span class="settings-kicker">{{ user.role === 'admin' ? 'ადმინისტრატორი' : 'მომხმარებელი' }}</span>
                    <h2>{{ user.name }}</h2>
                    <time>{{ user.createdAt ? (user.createdAt | date: 'mediumDate') : 'ColdMovie profile' }}</time>
                  </div>
                </div>

                <div class="user-result-stats">
                  <span><b>{{ user.stats.posts }}</b>პოსტი</span>
                  <span><b>{{ user.stats.favorites }}</b>ფავორიტი</span>
                  <span><b>{{ user.stats.likes }}</b>მოწონება</span>
                </div>

                <strong class="user-result-action">პროფილის ნახვა</strong>
              </a>
            }
          </div>
        } @else {
          <app-empty-state title="მომხმარებელი ვერ მოიძებნა" message="სცადე სხვა სახელი ან შეამოწმე მართლწერა." />
        }
      </section>
    </section>
  `,
})
export class SearchPageComponent implements OnInit {
  readonly users = signal<PublicUserSummary[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');
  queryValue = '';

  readonly filteredUsers = computed(() => {
    const query = this.query().trim().toLowerCase();
    const users = [...this.users()].sort((a, b) => {
      const scoreA = bScore(a);
      const scoreB = bScore(b);
      return scoreB - scoreA || a.name.localeCompare(b.name);
    });

    if (!query) {
      return users;
    }

    return users.filter((user) => `${user.name} ${user.role}`.toLowerCase().includes(query));
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly usersService: UsersService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const value = params.get('q') ?? '';
      this.query.set(value);
      this.queryValue = value;
    });

    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    const value = this.queryValue.trim();
    this.query.set(value);
    void this.router.navigate(['/search'], { queryParams: value ? { q: value } : {} });
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

function bScore(user: PublicUserSummary): number {
  return user.stats.posts * 5 + user.stats.favorites * 2 + user.stats.likes;
}
