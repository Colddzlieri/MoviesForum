import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MediaItem, SavedMediaItem } from '../../core/models/media.models';
import { MoviePost, PublicUserSummary } from '../../core/models/post.models';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { PostsService } from '../../core/services/posts.service';
import { TmdbApiService } from '../../core/services/tmdb-api.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-posts-page',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="posts-product-hero">
      @if (saving()) {
        <div class="publish-loading-overlay" role="status" aria-live="polite">
          <div class="publish-loading-card">
            <span class="publish-loader-mark" aria-hidden="true"></span>
            <b>{{ text('იტვირთება', 'Publishing') }}</b>
            <small>{{ text('პოსტი ქვეყნდება...', 'Your post is being published...') }}</small>
          </div>
        </div>
      }

      <div class="posts-hero-copy">
        <span class="settings-kicker">{{ text('ColdMovie საზოგადოება', 'ColdMovie Community') }}</span>
        <h1>{{ text('კინოს მოყვარულების ცოცხალი feed', 'A Live Feed for Movie People') }}</h1>
        <p>
          {{
            text(
              'დაწერე პოსტი, მონიშნე ფილმი ან სერიალი, მოიწონე, იპოვე სხვა user-ები და გახსენი მათი პროფილები.',
              'Publish posts, tag movies or series, like posts, discover users and open their public profiles.'
            )
          }}
        </p>
        <div class="posts-hero-actions">
          <button class="btn ghost" type="button" (click)="auth.isLoggedIn() ? focusComposer() : auth.open('login')">
            {{ auth.isLoggedIn() ? text('პოსტის დაწერა', 'Write a post') : text('შესვლა', 'Log in') }}
          </button>
        </div>
      </div>

      <div class="community-overview-card">
        <span>{{ text('საზოგადოება', 'Community') }}</span>
        <strong>{{ posts().length }}</strong>
        <small>{{ text('პოსტი feed-ში', 'posts in the feed') }}</small>
        <div>
          <b>{{ totalLikes() }}</b>
          <small>{{ text('ლაიქი', 'likes') }}</small>
        </div>
        <div>
          <b>{{ users().length }}</b>
          <small>{{ text('user', 'users') }}</small>
        </div>
      </div>
    </section>

    <section class="community-shell">
      <aside class="community-sidebar">
        <section class="community-panel profile-panel">
          @if (auth.currentUser(); as user) {
            <div class="panel-user">
              <div class="panel-avatar">
                @if (user.avatarUrl) {
                  <img [src]="user.avatarUrl" [alt]="user.name" />
                } @else {
                  <span>{{ initials(user.name) }}</span>
                }
              </div>
              <div>
                <span class="settings-kicker">{{ text('შენი პროფილი', 'Your profile') }}</span>
                <strong>{{ user.name }}</strong>
                <a [routerLink]="['/users', user.id]">{{ text('public გვერდი', 'public page') }}</a>
              </div>
            </div>
          } @else {
            <div class="panel-user">
              <div class="panel-avatar"><span>CM</span></div>
              <div>
                <span class="settings-kicker">{{ text('სტუმარი', 'Guest') }}</span>
                <strong>{{ text('შედი ანგარიშში', 'Log in to join') }}</strong>
                <button type="button" (click)="auth.open('login')">{{ text('შესვლა', 'Log in') }}</button>
              </div>
            </div>
          }
        </section>

        <section class="community-panel">
          <div class="panel-head">
            <div>
              <span class="settings-kicker">{{ text('ძებნა', 'Search') }}</span>
              <h2>{{ text('იპოვე user', 'Find people') }}</h2>
            </div>
          </div>
          <label class="mini-search">
            <input [(ngModel)]="userQuery" name="userQuery" [placeholder]="text('სახელი ან როლი...', 'Name or role...')" />
          </label>
          <div class="sidebar-user-list">
            @for (user of sidebarUsers(); track user.id) {
              <a [routerLink]="['/users', user.id]">
                <span class="mini-avatar">
                  @if (user.avatarUrl) {
                    <img [src]="user.avatarUrl" [alt]="user.name" />
                  } @else {
                    {{ initials(user.name) }}
                  }
                </span>
                <b>{{ user.name }}</b>
                <small>{{ user.stats.posts }} {{ text('პოსტი', 'posts') }}</small>
              </a>
            }
          </div>
        </section>
      </aside>

      <main class="community-main">
        <section class="post-composer product-composer" id="post-composer">
          <div class="composer-user">
            <div class="composer-avatar">
              @if (auth.currentUser()?.avatarUrl) {
                <img [src]="auth.currentUser()?.avatarUrl" [alt]="auth.currentUser()?.name || 'User'" />
              } @else {
                <span>{{ initials(auth.currentUser()?.name || 'CM') }}</span>
              }
            </div>
            <div>
              <span class="settings-kicker">{{ text('ახალი პოსტი', 'New post') }}</span>
              <h2>{{ text('რა ნახე საინტერესო?', 'What did you watch?') }}</h2>
              <p>
                {{
                  auth.isLoggedIn()
                    ? text('გააზიარე აზრი და მონიშნე ფილმი ან სერიალი TMDB კატალოგიდან.', 'Share your take and tag a movie or series from TMDB.')
                    : text('პოსტის დასაწერად, ლაიქისა და კომენტარისთვის საჭიროა შესვლა.', 'Log in to publish, like and comment.')
                }}
              </p>
            </div>
          </div>

          @if (auth.isLoggedIn()) {
            <form (ngSubmit)="createPost()" class="post-form product-post-form">
              <div class="composer-grid">
                <label class="field">
                  <span>{{ text('სათაური', 'Title') }}</span>
                  <input [(ngModel)]="title" name="title" [placeholder]="text('მაგ: კვირის საუკეთესო sci-fi', 'Example: Best sci-fi of the week')" />
                </label>
                <label class="field">
                  <span>{{ text('ფილმის მონიშვნა', 'Tag title') }}</span>
                  <input [(ngModel)]="movieQuery" name="movieQuery" (ngModelChange)="searchMovies()" [placeholder]="text('მოძებნე ფილმი ან სერიალი...', 'Search a movie or series...')" />
                </label>
              </div>

              <label class="field">
                <span>{{ text('პოსტი', 'Post') }}</span>
                <textarea
                  [(ngModel)]="content"
                  name="content"
                  rows="5"
                  [placeholder]="text('დაწერე რას ფიქრობ, ვის ურჩევ და რატომ...', 'Write what you think, who should watch it and why...')"
                ></textarea>
              </label>

              @if (movieResults().length) {
                <div class="media-pick-list product-pick-list">
                  @for (item of movieResults(); track item.mediaType + '-' + item.id) {
                    <button type="button" (click)="selectMedia(item)">
                      <img [src]="item.posterUrl" [alt]="item.title" />
                      <span>{{ item.title }}</span>
                      <small>{{ item.releaseYear || 'TBA' }} · {{ item.mediaType === 'movie' ? lang.t('movie') : lang.t('tv') }}</small>
                    </button>
                  }
                </div>
              }

              @if (selectedMedia().length) {
                <div class="selected-media-row premium-selected-row">
                  @for (item of selectedMedia(); track item.mediaType + '-' + item.id) {
                    <button type="button" (click)="removeMedia(item)">
                      {{ item.title }} <span>&times;</span>
                    </button>
                  }
                </div>
              }

              @if (error()) {
                <p class="form-error">{{ error() }}</p>
              }

              <div class="composer-actions">
                <span>{{ selectedMedia().length }} {{ text('მონიშნული title', 'tagged titles') }}</span>
                <button class="btn" type="submit">{{ text('გამოქვეყნება', 'Publish') }}</button>
              </div>
            </form>
          } @else {
            <section class="auth-required compact premium-auth-card">
              <p>{{ text('შედით ანგარიშში, რომ პოსტი დაწეროთ და feed-ში ჩაერთოთ.', 'Log in to post and join the feed.') }}</p>
              <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
            </section>
          }
        </section>

        <section class="feed-toolbar">
          <div>
            <span class="settings-kicker">{{ text('feed', 'feed') }}</span>
            <h2>{{ text('უახლესი პოსტები', 'Latest posts') }}</h2>
          </div>
          <label class="feed-search">
            <input [(ngModel)]="feedQuery" name="feedQuery" [placeholder]="text('პოსტის ან ფილმის ძებნა...', 'Search posts or tagged titles...')" />
          </label>
        </section>

        <div class="posts-feed product-post-feed">
          @if (loading()) {
            <app-loading-skeleton [count]="6" />
          } @else if (filteredPosts().length) {
            @for (post of filteredPosts(); track post.id) {
              <article class="post-card product-post-card">
                <header class="product-post-head">
                  <a class="post-author-link" [routerLink]="['/users', post.author.id]">
                    <span class="post-author-avatar">
                      @if (post.author.avatarUrl) {
                        <img [src]="post.author.avatarUrl" [alt]="post.author.name" />
                      } @else {
                        {{ initials(post.author.name) }}
                      }
                    </span>
                    <span>
                      <b>{{ post.author.name }}</b>
                      <time>{{ post.createdAt | date: 'mediumDate' }}</time>
                    </span>
                  </a>
                  <span class="post-status-chip" [class.like-count-pop]="isLikeAnimating(post.id)">{{ post.likeCount }} {{ text('ლაიქი', 'likes') }}</span>
                </header>

                <h2><a [routerLink]="['/posts', post.id]">{{ post.title }}</a></h2>
                <p class="post-copy">{{ post.content }}</p>

                @if (post.mediaItems.length) {
                  <div class="post-media-strip product-media-strip">
                    @for (item of post.mediaItems; track item.mediaType + '-' + item.id) {
                      <a [routerLink]="['/movie', item.mediaType + '-' + item.id]">
                        <img [src]="item.posterUrl" [alt]="item.title" />
                        <span>{{ item.title }}</span>
                        <small>{{ item.releaseYear || 'TBA' }}</small>
                      </a>
                    }
                  </div>
                }

                <div class="post-stats product-post-stats">
                  <span>{{ post.viewCount }} {{ text('ნახვა', 'views') }}</span>
                  <span>{{ post.likeCount }} {{ text('მოწონება', 'likes') }}</span>
                  <span>{{ post.commentCount }} {{ text('კომენტარი', 'comments') }}</span>
                </div>

                <div class="post-card-actions product-action-bar">
                  <button type="button" class="like-button" (click)="quickLike(post)" [disabled]="!auth.isLoggedIn()" [class.active]="post.likedByMe" [class.like-animate]="isLikeAnimating(post.id)">
                    <span class="like-icon" aria-hidden="true">♥</span>
                    <span class="like-ripple" aria-hidden="true"></span>
                    <span class="like-spark spark-one" aria-hidden="true"></span>
                    <span class="like-spark spark-two" aria-hidden="true"></span>
                    <span class="like-spark spark-three" aria-hidden="true"></span>
                    <span class="like-label">{{ post.likedByMe ? text('მოწონებულია', 'Liked') : text('მოწონება', 'Like') }}</span>
                  </button>
                  <a [routerLink]="['/posts', post.id]">{{ text('კომენტარი', 'Comment') }}</a>
                  <a [routerLink]="['/posts', post.id]">{{ lang.t('details') }}</a>
                </div>
              </article>
            }
          } @else {
            <section class="premium-empty-feed">
              <app-empty-state [title]="text('პოსტები ვერ მოიძებნა', 'No posts found')" [message]="text('სხვა სიტყვით სცადე ან პირველი პოსტი გამოაქვეყნე.', 'Try another search or publish the first post.')" />
            </section>
          }
        </div>
      </main>
    </section>
  `,
})
export class PostsPageComponent implements OnInit {
  readonly posts = signal<MoviePost[]>([]);
  readonly users = signal<PublicUserSummary[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly movieResults = signal<MediaItem[]>([]);
  readonly selectedMedia = signal<SavedMediaItem[]>([]);
  readonly likeAnimations = signal<Record<string, boolean>>({});
  title = '';
  content = '';
  movieQuery = '';
  feedQuery = '';
  userQuery = '';
  private searchTimer: number | null = null;
  private readonly likeAnimationTimers = new Map<string, number>();

  filteredPosts(): MoviePost[] {
    const query = this.feedQuery.trim().toLowerCase();
    if (!query) return this.posts();
    return this.posts().filter((post) =>
      [
        post.title,
        post.content,
        post.author.name,
        ...post.mediaItems.map((item) => item.title),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }

  sidebarUsers(): PublicUserSummary[] {
    const query = this.userQuery.trim().toLowerCase();
    const users = [...this.users()].sort((a, b) => b.stats.posts + b.stats.likes - (a.stats.posts + a.stats.likes));
    return users
      .filter((user) => !query || `${user.name} ${user.role}`.toLowerCase().includes(query))
      .slice(0, 8);
  }

  constructor(
    readonly auth: AuthService,
    readonly lang: LanguageService,
    private readonly postsService: PostsService,
    private readonly tmdb: TmdbApiService,
    private readonly usersService: UsersService,
  ) {}

  ngOnInit(): void {
    this.postsService.load().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.usersService.list().subscribe({
      next: (users) => this.users.set(users),
      error: () => undefined,
    });
  }

  totalLikes(): number {
    return this.posts().reduce((total, post) => total + post.likeCount, 0);
  }

  focusComposer(): void {
    document.getElementById('post-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  createPost(): void {
    this.error.set('');
    if (this.saving()) return;
    if (this.title.trim().length < 3 || this.content.trim().length < 10) {
      this.error.set(this.text('სათაური და მინიმუმ 10 სიმბოლოიანი ტექსტი საჭიროა.', 'Title and at least 10 characters of text are required.'));
      return;
    }

    this.saving.set(true);
    this.postsService.create({ title: this.title, content: this.content, mediaItems: this.selectedMedia() }).subscribe({
      next: (post) => {
        this.posts.update((posts) => [post, ...posts]);
        this.title = '';
        this.content = '';
        this.movieQuery = '';
        this.movieResults.set([]);
        this.selectedMedia.set([]);
        this.usersService.list().subscribe((users) => this.users.set(users));
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(error.error?.message || 'Post could not be saved.');
        this.saving.set(false);
      },
    });
  }

  searchMovies(): void {
    if (this.searchTimer) {
      window.clearTimeout(this.searchTimer);
    }

    const query = this.movieQuery.trim();
    if (query.length < 2) {
      this.movieResults.set([]);
      return;
    }

    this.searchTimer = window.setTimeout(() => {
      this.tmdb.search(query, 1).subscribe({
        next: (result) => this.movieResults.set(result.results.slice(0, 6)),
        error: () => this.movieResults.set([]),
      });
    }, 280);
  }

  selectMedia(item: MediaItem): void {
    const saved: SavedMediaItem = {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterUrl: item.posterUrl,
      releaseYear: item.releaseYear,
      rating: item.rating,
    };
    this.selectedMedia.update((items) => (items.some((current) => current.id === saved.id && current.mediaType === saved.mediaType) ? items : [...items, saved]));
    this.movieQuery = '';
    this.movieResults.set([]);
  }

  removeMedia(item: SavedMediaItem): void {
    this.selectedMedia.update((items) => items.filter((current) => current.id !== item.id || current.mediaType !== item.mediaType));
  }

  quickLike(post: MoviePost): void {
    if (!this.auth.requireLogin()) return;
    const shouldAnimate = !post.likedByMe;
    this.postsService.toggleLike(post.id).subscribe((updated) => {
      this.posts.update((posts) => posts.map((item) => (item.id === updated.id ? updated : item)));
      if (shouldAnimate && updated.likedByMe) {
        this.playLikeAnimation(post.id);
      }
    });
  }

  isLikeAnimating(postId: string): boolean {
    return Boolean(this.likeAnimations()[postId]);
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

  private playLikeAnimation(postId: string): void {
    const activeTimer = this.likeAnimationTimers.get(postId);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
    }

    this.likeAnimations.update((animations) => ({ ...animations, [postId]: true }));
    const timer = window.setTimeout(() => {
      this.likeAnimations.update((animations) => {
        const { [postId]: _removed, ...rest } = animations;
        return rest;
      });
      this.likeAnimationTimers.delete(postId);
    }, 780);
    this.likeAnimationTimers.set(postId, timer);
  }
}
