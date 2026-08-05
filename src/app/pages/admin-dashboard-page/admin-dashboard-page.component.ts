import { DatePipe } from '@angular/common';
import { Component, OnInit, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { SavedMediaItem } from '../../core/models/media.models';
import { AdminUserSummary, MoviePost, UserActivity } from '../../core/models/post.models';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { PostsService } from '../../core/services/posts.service';

interface ActionChartItem {
  action: string;
  label: string;
  count: number;
}

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="admin-dashboard-hero">
      <div>
        <span class="settings-kicker">ColdMovie Admin</span>
        <h1>{{ text('ადმინ დეშბორდი', 'Admin Dashboard') }}</h1>
        <p>{{ text('პოსტების, მომხმარებლების, აქტივობისა და ჩართულობის სრული კონტროლი.', 'Full control over posts, users, activity and engagement.') }}</p>
      </div>
      <div class="admin-hero-actions">
        <button class="btn ghost" type="button" (click)="reload()">{{ text('განახლება', 'Refresh') }}</button>
        <a class="btn" routerLink="/">Feed-ზე გადასვლა</a>
      </div>
    </section>

    <section class="page-pad admin-dashboard">
      @if (!auth.isAdmin()) {
        <section class="auth-required admin-login-card">
          <h2>{{ text('მხოლოდ ადმინისთვის', 'Admin only') }}</h2>
          <p>{{ text('შედი ანგარიშით: Cold / Cold', 'Log in with: Cold / Cold') }}</p>
          <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
        </section>
      } @else if (loading()) {
        <app-loading-skeleton [count]="10" />
      } @else {
        <div class="admin-kpi-grid">
          <article>
            <span>{{ text('პოსტები', 'Posts') }}</span>
            <strong>{{ posts().length }}</strong>
            <small>{{ text('სულ გამოქვეყნებული', 'Total published') }}</small>
          </article>
          <article>
            <span>{{ text('მომხმარებლები', 'Users') }}</span>
            <strong>{{ combinedUsers().length }}</strong>
            <small>{{ text('აქტიური პროფილები', 'Known profiles') }}</small>
          </article>
          <article>
            <span>{{ text('ნახვები', 'Views') }}</span>
            <strong>{{ totalViews() }}</strong>
            <small>{{ text('პოსტების გახსნები', 'Post opens') }}</small>
          </article>
          <article>
            <span>{{ text('ჩართულობა', 'Engagement') }}</span>
            <strong>{{ totalEngagement() }}</strong>
            <small>{{ totalLikes() }} {{ text('მოწონება', 'likes') }} · {{ totalComments() }} {{ text('კომენტარი', 'comments') }}</small>
          </article>
        </div>

        <div class="admin-analytics-grid">
          <section class="admin-chart-card">
            <div class="admin-panel-head">
              <div>
                <span class="settings-kicker">{{ text('ჩართულობა', 'Engagement') }}</span>
                <h2>{{ text('მოწონებები / კომენტარები / ნახვები', 'Likes / Comments / Views') }}</h2>
              </div>
            </div>
            <div class="donut-wrap">
              <div class="dashboard-donut" [style.background]="engagementDonut()">
                <span>{{ totalEngagement() }}</span>
              </div>
              <div class="donut-legend">
                <span><i class="legend-like"></i>{{ text('მოწონებები', 'Likes') }} · {{ totalLikes() }}</span>
                <span><i class="legend-comment"></i>{{ text('კომენტარები', 'Comments') }} · {{ totalComments() }}</span>
                <span><i class="legend-view"></i>{{ text('ნახვები', 'Views') }} · {{ totalViews() }}</span>
              </div>
            </div>
          </section>

          <section class="admin-chart-card">
            <div class="admin-panel-head">
              <div>
                <span class="settings-kicker">{{ text('აქტივობა', 'Activity') }}</span>
                <h2>{{ text('მოქმედებების ტიპები', 'Action Breakdown') }}</h2>
              </div>
            </div>
            <div class="action-bars">
              @for (item of actionChart(); track item.action) {
                <div>
                  <label>{{ item.label }} <b>{{ item.count }}</b></label>
                  <span><i [style.width.%]="barPercent(item.count)"></i></span>
                </div>
              } @empty {
                <p class="muted">{{ text('აქტივობა ჯერ არ არის.', 'No activity yet.') }}</p>
              }
            </div>
          </section>

          <section class="admin-chart-card top-posts-card">
            <div class="admin-panel-head">
              <div>
                <span class="settings-kicker">{{ text('ტოპ პოსტები', 'Top Posts') }}</span>
                <h2>{{ text('ყველაზე აქტიური პოსტები', 'Most Active Posts') }}</h2>
              </div>
            </div>
            <div class="top-post-list">
              @for (post of topPosts(); track post.id) {
                <span class="top-post-static">
                  <span>{{ post.title }}</span>
                  <b>{{ post.viewCount + post.likeCount + post.commentCount }}</b>
                </span>
              } @empty {
                <p class="muted">{{ text('პოსტები ჯერ არ არის.', 'No posts yet.') }}</p>
              }
            </div>
          </section>
        </div>

        <div class="admin-control-grid dashboard-control-grid">
          <section class="admin-users-panel">
            <div class="admin-panel-head">
              <div>
                <span class="settings-kicker">{{ text('მომხმარებლები', 'Users') }}</span>
                <h2>{{ text('ყველა იუზერი', 'All Users') }}</h2>
              </div>
              <strong>{{ combinedUsers().length }}</strong>
            </div>
            <div class="admin-user-list dashboard-user-list">
              @for (user of combinedUsers(); track user.id) {
                <button type="button" (click)="searchUser(user)">
                  <span>{{ initials(user.name) }}</span>
                  <b>{{ user.name }}</b>
                  <small>{{ user.email }} · {{ user.role }}</small>
                </button>
              }
            </div>
          </section>

          <section class="admin-activity-panel">
            <div class="admin-panel-head">
              <div>
                <span class="settings-kicker">{{ text('ძიება', 'Search') }}</span>
                <h2>{{ text('იუზერის ყველა მოქმედება', 'User Action Audit') }}</h2>
              </div>
            </div>
            <form class="admin-activity-search" (ngSubmit)="loadActivities()">
              <input [(ngModel)]="activityQuery" name="activityQuery" [placeholder]="text('სახელი, email, id ან მოქმედება...', 'Name, email, id or action...')" />
              <button class="btn" type="submit">{{ lang.t('search') }}</button>
            </form>
            <div class="activity-list dashboard-activity-list">
              @for (activity of activities(); track activity.id) {
                <article>
                  <div>
                    <strong>{{ activity.user.name }}</strong>
                    <span>{{ actionLabel(activity.action) }}</span>
                  </div>
                  <p>{{ activity.meta.postTitle || activity.meta.postId || '-' }}</p>
                  <time>{{ activity.createdAt | date: 'medium' }}</time>
                </article>
              } @empty {
                <p class="muted">{{ text('აქტივობა ჯერ არ არის.', 'No activity yet.') }}</p>
              }
            </div>
          </section>
        </div>

        <section class="admin-management-card">
          <div class="admin-panel-head">
            <div>
              <span class="settings-kicker">{{ text('მართვა', 'Management') }}</span>
              <h2>{{ text('ყველა პოსტი', 'All Posts') }}</h2>
            </div>
            <span class="admin-count-pill">{{ posts().length }}</span>
          </div>

          @if (posts().length) {
            <div class="admin-post-list">
              @for (post of posts(); track post.id) {
                <article class="admin-post-card">
                  @if (editingId() === post.id) {
                    <div class="admin-edit-form">
                      <label class="field">
                        <span>{{ text('სათაური', 'Title') }}</span>
                        <input [(ngModel)]="editTitle" name="editTitle-{{ post.id }}" />
                      </label>
                      <label class="field">
                        <span>{{ text('ტექსტი', 'Text') }}</span>
                        <textarea [(ngModel)]="editContent" name="editContent-{{ post.id }}" rows="6"></textarea>
                      </label>
                      <div class="selected-media-row">
                        @for (media of editMedia(); track media.mediaType + '-' + media.id) {
                          <button type="button" (click)="removeEditMedia(media)">{{ media.title }} <span>&times;</span></button>
                        }
                      </div>
                      <div class="admin-actions">
                        <button class="btn" type="button" (click)="saveEdit(post)">{{ text('შენახვა', 'Save') }}</button>
                        <button class="btn ghost" type="button" (click)="cancelEdit()">{{ text('გაუქმება', 'Cancel') }}</button>
                      </div>
                    </div>
                  } @else {
                    <div class="admin-post-main">
                      <div>
                        <span class="settings-kicker">{{ post.author.name }} · {{ post.createdAt | date: 'mediumDate' }}</span>
                        <h2>{{ post.title }}</h2>
                        <p>{{ post.content }}</p>
                      </div>
                      <div class="admin-metrics">
                        <span>{{ post.viewCount }} {{ text('ნახვა', 'views') }}</span>
                        <span>{{ post.likeCount }} {{ text('მოწონება', 'likes') }}</span>
                        <span>{{ post.commentCount }} {{ text('კომენტარი', 'comments') }}</span>
                        <span>{{ post.mediaItems.length }} {{ text('მონიშვნა', 'tags') }}</span>
                      </div>
                      <div class="admin-actions">
                        <button class="btn ghost" type="button" (click)="startEdit(post)">{{ text('რედაქტირება', 'Edit') }}</button>
                        <button class="btn danger" type="button" (click)="deletePost(post)">{{ text('წაშლა', 'Delete') }}</button>
                      </div>
                    </div>
                  }
                </article>
              }
            </div>
          } @else {
            <app-empty-state [title]="text('პოსტები ჯერ არ არის', 'No posts yet')" [message]="text('გამოქვეყნებული პოსტები აქ გამოჩნდება.', 'Published posts will appear here.')" />
          }
        </section>
      }
    </section>
  `,
})
export class AdminDashboardPageComponent implements OnInit {
  readonly posts = signal<MoviePost[]>([]);
  readonly loading = signal(true);
  readonly editingId = signal<string | null>(null);
  readonly editMedia = signal<SavedMediaItem[]>([]);
  readonly backendUsers = signal<AdminUserSummary[]>([]);
  readonly activities = signal<UserActivity[]>([]);
  editTitle = '';
  editContent = '';
  activityQuery = '';
  private loaded = false;

  constructor(
    readonly auth: AuthService,
    readonly lang: LanguageService,
    private readonly postsService: PostsService,
  ) {
    effect(() => {
      if (this.auth.isAdmin() && !this.loaded) {
        this.loading.set(true);
        this.reload();
      }
    });
  }

  ngOnInit(): void {
    if (!this.auth.isAdmin()) {
      this.loading.set(false);
      return;
    }
    if (!this.loaded) {
      this.reload();
    }
  }

  reload(): void {
    this.loaded = true;
    this.postsService.load().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
        this.loadAdminData();
      },
      error: () => this.loading.set(false),
    });
  }

  loadAdminData(): void {
    this.postsService.adminUsers().subscribe((users) => this.backendUsers.set(users));
    this.loadActivities();
  }

  loadActivities(): void {
    this.postsService.adminActivities(this.activityQuery).subscribe((activities) => this.activities.set(activities));
  }

  combinedUsers(): AdminUserSummary[] {
    const users = new Map<string, AdminUserSummary>();
    this.auth.allUsers().forEach((user) => users.set(user.id, { id: user.id, name: user.name, email: user.email, role: user.role || 'user' }));
    this.backendUsers().forEach((user) => users.set(user.id, user));
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  searchUser(user: AdminUserSummary): void {
    this.activityQuery = user.email || user.name;
    this.loadActivities();
  }

  totalViews(): number {
    return this.posts().reduce((total, post) => total + post.viewCount, 0);
  }

  totalLikes(): number {
    return this.posts().reduce((total, post) => total + post.likeCount, 0);
  }

  totalComments(): number {
    return this.posts().reduce((total, post) => total + post.commentCount, 0);
  }

  totalEngagement(): number {
    return this.totalViews() + this.totalLikes() + this.totalComments();
  }

  topPosts(): MoviePost[] {
    return [...this.posts()]
      .sort((a, b) => b.viewCount + b.likeCount + b.commentCount - (a.viewCount + a.likeCount + a.commentCount))
      .slice(0, 5);
  }

  actionChart(): ActionChartItem[] {
    const counts = new Map<string, number>();
    this.activities().forEach((activity) => counts.set(activity.action, (counts.get(activity.action) || 0) + 1));
    return [...counts.entries()]
      .map(([action, count]) => ({ action, count, label: this.actionLabel(action) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }

  barPercent(count: number): number {
    const max = Math.max(1, ...this.actionChart().map((item) => item.count));
    return Math.max(8, Math.round((count / max) * 100));
  }

  engagementDonut(): string {
    const likes = this.totalLikes();
    const comments = this.totalComments();
    const views = this.totalViews();
    const total = Math.max(1, likes + comments + views);
    const likeDeg = (likes / total) * 360;
    const commentDeg = likeDeg + (comments / total) * 360;
    return `conic-gradient(#1877f2 0deg ${likeDeg}deg, #72a8ff ${likeDeg}deg ${commentDeg}deg, #72a8ff ${commentDeg}deg 360deg)`;
  }

  startEdit(post: MoviePost): void {
    this.editingId.set(post.id);
    this.editTitle = post.title;
    this.editContent = post.content;
    this.editMedia.set([...post.mediaItems]);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editTitle = '';
    this.editContent = '';
    this.editMedia.set([]);
  }

  removeEditMedia(media: SavedMediaItem): void {
    this.editMedia.update((items) => items.filter((item) => item.id !== media.id || item.mediaType !== media.mediaType));
  }

  saveEdit(post: MoviePost): void {
    this.postsService.update(post.id, { title: this.editTitle, content: this.editContent, mediaItems: this.editMedia() }).subscribe((updated) => {
      this.posts.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      this.cancelEdit();
      this.loadAdminData();
    });
  }

  deletePost(post: MoviePost): void {
    if (!window.confirm(`Delete "${post.title}"?`)) {
      return;
    }
    this.postsService.remove(post.id).subscribe(() => {
      this.posts.update((items) => items.filter((item) => item.id !== post.id));
      this.loadAdminData();
    });
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      'post.created': this.text('პოსტი შექმნა', 'Created post'),
      'post.viewed': this.text('პოსტი ნახა', 'Viewed post'),
      'post.updated': this.text('პოსტი დაარედაქტირა', 'Updated post'),
      'post.deleted': this.text('პოსტი წაშალა', 'Deleted post'),
      'post.liked': this.text('მოიწონა', 'Liked post'),
      'post.unliked': this.text('მოწონება მოხსნა', 'Unliked post'),
      'post.commented': this.text('კომენტარი დაწერა', 'Commented'),
    };
    return labels[action] || action;
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

  text(ka: string, en: string): string {
    return this.lang.language() === 'ka' ? ka : en;
  }
}
