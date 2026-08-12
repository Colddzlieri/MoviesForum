import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MediaItem, SavedMediaItem } from '../../core/models/media.models';
import { MoviePost } from '../../core/models/post.models';
import { AuthService } from '../../core/services/auth.service';
import { PostsService } from '../../core/services/posts.service';
import { TmdbApiService } from '../../core/services/tmdb-api.service';

@Component({
  selector: 'app-home-page',
  imports: [FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="facebook-feed-page">
      <div class="fb-shell">
        <aside class="fb-left-rail" aria-label="გვერდის სწრაფი ნავიგაცია">
          <section class="fb-rail-card fb-profile-card">
            @if (auth.currentUser(); as user) {
              <a class="fb-profile-row fb-profile-link" [routerLink]="['/users', user.id]">
                <span class="fb-avatar xl">
                  @if (user.avatarUrl) {
                    <img [src]="user.avatarUrl" [alt]="user.name" />
                  } @else {
                    {{ initials(user.name) }}
                  }
                </span>
                <div>
                  <strong>{{ user.name }}</strong>
                  <small>{{ user.role === 'admin' ? 'ადმინისტრატორი' : 'ColdMovie წევრი' }}</small>
                </div>
              </a>
              <button type="button" class="fb-wide-action" routerLink="/profile">პროფილის პარამეტრები</button>
            } @else {
              <div class="fb-profile-row">
                <span class="fb-avatar xl">CM</span>
                <div>
                  <strong>შემოდი ანგარიშში</strong>
                  <small>პოსტებისთვის, ლაიქებისა და კომენტარებისთვის</small>
                </div>
              </div>
              <div class="fb-login-row">
                <button type="button" (click)="auth.open('login')">შესვლა</button>
                <button type="button" (click)="auth.open('register')">რეგისტრაცია</button>
              </div>
            }
          </section>

          <nav class="fb-rail-card fb-shortcuts" aria-label="ColdMovie მენიუ">
            <a routerLink="/" class="active"><span>⌂</span><b>ლენტი</b></a>
            <a routerLink="/movies"><span>▶</span><b>ფილმები</b></a>
            <a routerLink="/series"><span>TV</span><b>სერიალები</b></a>
            <a routerLink="/reels"><span>▮</span><b>რილსები</b></a>
            <a routerLink="/favorites"><span>♥</span><b>ფავორიტები</b></a>
            <a routerLink="/watchlist"><span>＋</span><b>სანახავი</b></a>
          </nav>
        </aside>

        <main class="fb-main-feed">
          <section class="fb-card fb-composer" id="post-composer">
            <div class="fb-composer-head">
              @if (auth.currentUser(); as user) {
                <a class="fb-avatar fb-avatar-link" [routerLink]="['/users', user.id]" aria-label="პროფილის ნახვა">
                  @if (user.avatarUrl) {
                    <img [src]="user.avatarUrl" [alt]="user.name" />
                  } @else {
                    {{ initials(user.name) }}
                  }
                </a>
              } @else {
                <span class="fb-avatar">CM</span>
              }
              <button type="button" class="fb-compose-prompt" (click)="auth.isLoggedIn() ? focusComposer() : auth.open('login')">
                რას უყურე დღეს?
              </button>
            </div>

            @if (auth.isLoggedIn()) {
              <form class="fb-composer-form" (ngSubmit)="savePost()">
                <label class="fb-title-field">
                  <span>სათაური</span>
                  <input id="composer-title-input" [(ngModel)]="postTitle" name="postTitle" maxlength="90" placeholder="დაწერე პოსტის სათაური..." />
                </label>

                <textarea
                  id="composer-textarea"
                  [(ngModel)]="postBody"
                  name="postBody"
                  rows="4"
                  placeholder="გაუზიარე სხვებს შთაბეჭდილება, რეკომენდაცია ან შეკითხვა..."
                ></textarea>

                <div class="fb-photo-tools">
                  <label class="fb-photo-upload">
                    <input type="file" accept="image/*" (change)="uploadPostPhoto($event)" />
                    <span aria-hidden="true">▧</span>
                    <b>ფოტოს დამატება</b>
                    <small>JPG, PNG, WEBP · მაქს. 4MB</small>
                  </label>

                  @if (uploadedPhoto(); as photo) {
                    <figure class="fb-photo-preview">
                      <img [src]="photo.url" [alt]="photo.name" />
                      <figcaption>{{ photo.name }}</figcaption>
                      <button type="button" (click)="removePostPhoto()" aria-label="ფოტოს წაშლა">×</button>
                    </figure>
                  }
                </div>

                <div class="fb-media-search">
                  <label>
                    <span>ფილმის ან სერიალის მონიშვნა</span>
                    <input [(ngModel)]="mediaQuery" name="mediaQuery" (ngModelChange)="searchMedia()" placeholder="მოძებნე სათაური TMDB კატალოგიდან" />
                  </label>
                </div>

                @if (mediaResults().length) {
                  <div class="fb-media-results">
                    @for (item of mediaResults(); track item.mediaType + '-' + item.id) {
                      <button type="button" (click)="selectMedia(item)">
                        <img [src]="item.posterUrl" [alt]="item.title" />
                        <span>{{ item.title }}</span>
                        <small>{{ item.releaseYear || 'უცნობი წელი' }} · {{ mediaTypeLabel(item.mediaType) }}</small>
                      </button>
                    }
                  </div>
                }

                @if (selectedMedia().length) {
                  <div class="fb-selected-media">
                    @for (item of selectedMedia(); track item.mediaType + '-' + item.id) {
                      <article class="fb-selected-title-card">
                        <img [src]="item.posterUrl" [alt]="item.title" />
                        <span>
                          <b>{{ item.title }}</b>
                          <small>{{ item.releaseYear || 'უცნობი წელი' }} · {{ mediaTypeLabel(item.mediaType) }}</small>
                        </span>
                        <button type="button" (click)="removeMedia(item)" aria-label="მონიშვნის წაშლა">×</button>
                      </article>
                    }
                  </div>
                }

                @if (error()) {
                  <p class="form-error">{{ error() }}</p>
                }

                <div class="fb-composer-actions">
                  <span>{{ composerMeta() }}</span>
                  <button class="btn" type="submit">გამოქვეყნება</button>
                </div>
              </form>
            } @else {
              <div class="fb-auth-note">
                <p>პოსტის დასაწერად, მოწონებისთვის და კომენტარისთვის საჭიროა ანგარიშში შესვლა.</p>
                <button type="button" class="btn" (click)="auth.open('login')">შესვლა</button>
              </div>
            }
          </section>

          <div class="fb-post-list">
            @if (loading()) {
              <app-loading-skeleton [count]="6" />
            } @else if (filteredPosts().length) {
              @for (post of filteredPosts(); track post.id) {
                <article class="fb-card fb-post-card">
                  <header class="fb-post-header">
                    <a class="fb-post-identity" [routerLink]="['/users', post.author.id]">
                      <span class="fb-avatar">
                        @if (post.author.avatarUrl) {
                          <img [src]="post.author.avatarUrl" [alt]="post.author.name" />
                        } @else {
                          {{ initials(post.author.name) }}
                        }
                      </span>
                      <div class="fb-post-author">
                        <strong>{{ post.author.name }}</strong>
                        <small>{{ formatDate(post.createdAt) }}</small>
                      </div>
                    </a>
                    @if (canManagePost(post)) {
                      <div class="fb-post-menu-wrap">
                        <button type="button" class="fb-post-menu" aria-label="პოსტის მენიუ" (click)="togglePostMenu(post.id, $event)">•••</button>
                        @if (openPostMenuId() === post.id) {
                          <div class="fb-post-dropdown">
                            <button type="button" (click)="startEdit(post)">რედაქტირება</button>
                            <button type="button" class="danger" (click)="deletePost(post)">წაშლა</button>
                          </div>
                        }
                      </div>
                    }
                  </header>

                  @if (editingPostId() === post.id) {
                    <form class="fb-inline-edit-form" (ngSubmit)="saveInlineEdit(post)">
                      <input
                        [(ngModel)]="editTitle"
                        [name]="'edit-title-' + post.id"
                        maxlength="90"
                        placeholder="პოსტის სათაური"
                      />
                      <textarea
                        [(ngModel)]="editContent"
                        [name]="'edit-content-' + post.id"
                        rows="4"
                        placeholder="პოსტის ტექსტი"
                      ></textarea>
                      @if (editError()) {
                        <p class="form-error">{{ editError() }}</p>
                      }
                      <div class="fb-inline-edit-actions">
                        <button class="btn ghost" type="button" (click)="cancelEdit()">გაუქმება</button>
                        <button class="btn" type="submit">შენახვა</button>
                      </div>
                    </form>
                  } @else {
                    <div class="fb-post-body">
                      <h2>{{ post.title }}</h2>
                      <p>{{ post.content }}</p>
                    </div>
                  }

                  @if (post.photoUrl) {
                    <figure class="fb-post-photo">
                      <img [src]="post.photoUrl" [alt]="post.photoName || post.title" loading="lazy" />
                    </figure>
                  }

                  @if (post.mediaItems.length) {
                    <div class="fb-post-tagged-titles" [class.single]="post.mediaItems.length === 1">
                      @for (item of post.mediaItems; track item.mediaType + '-' + item.id) {
                        <a class="fb-tagged-title-card" [routerLink]="['/movie', item.mediaType + '-' + item.id]">
                          <img [src]="item.posterUrl" [alt]="item.title" />
                          <span>
                            <b>{{ item.title }}</b>
                            <small>{{ item.releaseYear || 'უცნობი წელი' }} · {{ mediaTypeLabel(item.mediaType) }} · ★ {{ item.rating || 'N/A' }}</small>
                          </span>
                          <i aria-hidden="true">›</i>
                        </a>
                      }
                    </div>
                  }

                  <div class="fb-post-stats">
                    <span [class.like-count-pop]="isLikeAnimating(post.id)">♥ {{ post.likeCount }} მოწონება</span>
                    <span>{{ post.commentCount }} კომენტარი</span>
                  </div>

                  <div class="fb-action-bar">
                    <button type="button" class="like-button" [class.active]="post.likedByMe" [class.like-animate]="isLikeAnimating(post.id)" (click)="toggleLike(post)">
                      <span class="like-icon" aria-hidden="true">♥</span>
                      <span class="like-ripple" aria-hidden="true"></span>
                      <span class="like-spark spark-one" aria-hidden="true"></span>
                      <span class="like-spark spark-two" aria-hidden="true"></span>
                      <span class="like-spark spark-three" aria-hidden="true"></span>
                      <span class="like-label">{{ post.likedByMe ? 'მოწონებულია' : 'მოწონება' }}</span>
                    </button>
                    <button type="button" (click)="focusComment(post.id)">
                      <span>▱</span>
                      კომენტარი
                    </button>
                  </div>

                  <section class="fb-comments" aria-label="კომენტარები">
                    @if (post.comments.length) {
                      @for (comment of post.comments; track comment.id) {
                        <article class="fb-comment-thread">
                          <div class="fb-comment-row">
                            <a class="fb-avatar sm fb-avatar-link" [routerLink]="['/users', comment.author.id]" aria-label="პროფილის ნახვა">
                              @if (comment.author.avatarUrl) {
                                <img [src]="comment.author.avatarUrl" [alt]="comment.author.name" />
                              } @else {
                                {{ initials(comment.author.name) }}
                              }
                            </a>
                            <div class="fb-comment-bubble">
                              <a class="fb-comment-name" [routerLink]="['/users', comment.author.id]">{{ comment.author.name }}</a>
                              <p>{{ comment.text }}</p>
                              <div class="fb-comment-tools">
                                <small>{{ formatDate(comment.createdAt) }}</small>
                                <button type="button" [class.active]="comment.reactedByMe" (click)="toggleCommentReaction(post, comment.id)">♥ {{ comment.reactionCount || 0 }}</button>
                                <button type="button" (click)="toggleReplyForm(post.id, comment.id)">პასუხი</button>
                              </div>
                            </div>
                          </div>

                          @if (comment.replies?.length) {
                            <div class="fb-comment-replies">
                              @for (reply of comment.replies; track reply.id) {
                                <article class="fb-comment-reply">
                                  <span class="reply-thread-label">პასუხი</span>
                                  <a class="fb-avatar sm fb-avatar-link" [routerLink]="['/users', reply.author.id]" aria-label="პროფილის ნახვა">
                                    @if (reply.author.avatarUrl) {
                                      <img [src]="reply.author.avatarUrl" [alt]="reply.author.name" />
                                    } @else {
                                      {{ initials(reply.author.name) }}
                                    }
                                  </a>
                                  <div class="fb-comment-bubble reply">
                                    <a class="fb-comment-name" [routerLink]="['/users', reply.author.id]">{{ reply.author.name }}</a>
                                    <p>{{ reply.text }}</p>
                                    <div class="fb-comment-tools">
                                      <small>{{ formatDate(reply.createdAt) }}</small>
                                      <button type="button" [class.active]="reply.reactedByMe" (click)="toggleReplyReaction(post, comment.id, reply.id)">♥ {{ reply.reactionCount || 0 }}</button>
                                    </div>
                                  </div>
                                </article>
                              }
                            </div>
                          }

                          @if (isReplyFormOpen(post.id, comment.id)) {
                            @if (auth.isLoggedIn()) {
                              <form class="fb-comment-form fb-reply-form" (ngSubmit)="addReply(post, comment.id)">
                                @if (auth.currentUser(); as user) {
                                  <a class="fb-avatar sm fb-avatar-link" [routerLink]="['/users', user.id]" aria-label="პროფილის ნახვა">
                                    @if (user.avatarUrl) {
                                      <img [src]="user.avatarUrl" [alt]="user.name" />
                                    } @else {
                                      {{ initials(user.name) }}
                                    }
                                  </a>
                                }
                                <input
                                  [id]="'reply-' + post.id + '-' + comment.id"
                                  [ngModel]="replyDrafts()[replyKey(post.id, comment.id)] || ''"
                                  (ngModelChange)="setReplyDraft(post.id, comment.id, $event)"
                                  [ngModelOptions]="{ standalone: true }"
                                  placeholder="დაწერე პასუხი..."
                                />
                                <button type="submit">პასუხი</button>
                              </form>
                            } @else {
                              <button type="button" class="fb-comment-login nested" (click)="auth.open('login')">პასუხისთვის შედი ანგარიშში</button>
                            }
                          }
                        </article>
                      }
                    }

                    @if (auth.isLoggedIn()) {
                      <form class="fb-comment-form" (ngSubmit)="addComment(post)">
                        @if (auth.currentUser(); as user) {
                          <a class="fb-avatar sm fb-avatar-link" [routerLink]="['/users', user.id]" aria-label="პროფილის ნახვა">
                            @if (user.avatarUrl) {
                              <img [src]="user.avatarUrl" [alt]="user.name" />
                            } @else {
                              {{ initials(user.name) }}
                            }
                          </a>
                        }
                        <input
                          [id]="'comment-' + post.id"
                          [ngModel]="commentDrafts()[post.id] || ''"
                          (ngModelChange)="setCommentDraft(post.id, $event)"
                          [ngModelOptions]="{ standalone: true }"
                          placeholder="დაწერე კომენტარი..."
                        />
                        <button type="submit">გაგზავნა</button>
                      </form>
                    } @else {
                      <button type="button" class="fb-comment-login" (click)="auth.open('login')">კომენტარის დასაწერად შედი ანგარიშში</button>
                    }
                  </section>
                </article>
              }
            } @else {
              <section class="fb-card">
                <app-empty-state title="პოსტები ვერ მოიძებნა" message="სხვა სიტყვით სცადე ან პირველი პოსტი გამოაქვეყნე." />
              </section>
            }
          </div>
        </main>
      </div>
    </section>
  `,
})
export class HomePageComponent implements OnInit {
  readonly posts = signal<MoviePost[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly mediaResults = signal<MediaItem[]>([]);
  readonly selectedMedia = signal<SavedMediaItem[]>([]);
  readonly uploadedPhoto = signal<{ url: string; name: string } | null>(null);
  readonly commentDrafts = signal<Record<string, string>>({});
  readonly replyDrafts = signal<Record<string, string>>({});
  readonly openReplyForms = signal<Record<string, boolean>>({});
  readonly likeAnimations = signal<Record<string, boolean>>({});
  readonly openPostMenuId = signal<string | null>(null);
  readonly editingPostId = signal<string | null>(null);
  readonly editError = signal('');

  postBody = '';
  postTitle = '';
  editTitle = '';
  editContent = '';
  mediaQuery = '';
  feedQuery = '';
  private mediaSearchTimer: number | null = null;
  private readonly likeAnimationTimers = new Map<string, number>();

  constructor(
    readonly auth: AuthService,
    private readonly postsService: PostsService,
    private readonly tmdb: TmdbApiService,
  ) {}

  ngOnInit(): void {
    this.loadPosts();
  }

  filteredPosts(): MoviePost[] {
    const query = this.feedQuery.trim().toLowerCase();
    if (!query) {
      return this.posts();
    }

    return this.posts().filter((post) =>
      [
        post.title,
        post.content,
        post.author.name,
        ...post.mediaItems.map((item) => item.title),
        ...post.comments.map((comment) => `${comment.author.name} ${comment.text}`),
        ...post.comments.flatMap((comment) => (comment.replies ?? []).map((reply) => `${reply.author.name} ${reply.text}`)),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }

  savePost(): void {
    this.error.set('');
    if (!this.auth.requireLogin()) {
      return;
    }

    const content = this.postBody.trim();
    const title = this.postTitle.trim();
    if (title.length < 3 || content.length < 10) {
      this.error.set('სათაური და მინიმუმ 10 სიმბოლოიანი პოსტის ტექსტი საჭიროა.');
      return;
    }

    const payload = {
      title,
      content,
      photoUrl: this.uploadedPhoto()?.url ?? null,
      photoName: this.uploadedPhoto()?.name ?? null,
      mediaItems: this.selectedMedia(),
    };
    this.postsService.create(payload).subscribe({
      next: (post) => {
        this.posts.update((posts) => [post, ...posts]);
        this.resetComposer();
      },
      error: (error) => this.error.set(error.error?.message || 'Post could not be saved.'),
    });
  }

  searchMedia(): void {
    if (this.mediaSearchTimer !== null) {
      window.clearTimeout(this.mediaSearchTimer);
    }

    const query = this.mediaQuery.trim();
    if (query.length < 2) {
      this.mediaResults.set([]);
      return;
    }

    this.mediaSearchTimer = window.setTimeout(() => {
      this.tmdb.search(query, 1).subscribe({
        next: (result) => this.mediaResults.set(result.results.slice(0, 8)),
        error: () => this.mediaResults.set([]),
      });
    }, 260);
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
    this.mediaQuery = '';
    this.mediaResults.set([]);
  }

  removeMedia(item: SavedMediaItem): void {
    this.selectedMedia.update((items) => items.filter((current) => current.id !== item.id || current.mediaType !== item.mediaType));
  }

  uploadPostPhoto(event: Event): void {
    this.error.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isSupportedImage(file)) {
      this.error.set('აირჩიე სწორი სურათის ფაილი.');
      input.value = '';
      return;
    }

    if (file.size > 4_000_000) {
      this.error.set('ფოტო მაქსიმუმ 4MB უნდა იყოს.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        this.error.set('ფოტოს წაკითხვა ვერ მოხერხდა.');
        input.value = '';
        return;
      }

      this.uploadedPhoto.set({ url: result, name: file.name || 'post-photo' });
      input.value = '';
    };
    reader.onerror = () => {
      this.error.set('ფოტოს წაკითხვა ვერ მოხერხდა.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removePostPhoto(): void {
    this.uploadedPhoto.set(null);
  }

  canManagePost(post: MoviePost): boolean {
    const user = this.auth.currentUser();
    return Boolean(user && (user.id === post.author.id || user.role === 'admin'));
  }

  togglePostMenu(postId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openPostMenuId.update((activeId) => (activeId === postId ? null : postId));
  }

  startEdit(post: MoviePost): void {
    if (!this.canManagePost(post)) {
      return;
    }

    this.editingPostId.set(post.id);
    this.openPostMenuId.set(null);
    this.editError.set('');
    this.editTitle = post.title;
    this.editContent = post.content;
  }

  cancelEdit(): void {
    this.resetInlineEdit();
  }

  saveInlineEdit(post: MoviePost): void {
    if (!this.canManagePost(post)) {
      return;
    }

    const title = this.editTitle.trim();
    const content = this.editContent.trim();
    if (title.length < 3 || content.length < 10) {
      this.editError.set('სათაური და მინიმუმ 10 სიმბოლოიანი ტექსტი საჭიროა.');
      return;
    }

    this.postsService
      .update(post.id, {
        title,
        content,
        photoUrl: post.photoUrl || null,
        photoName: post.photoName || null,
        mediaItems: post.mediaItems,
      })
      .subscribe({
        next: (updated) => {
          this.replacePost(updated);
          this.resetInlineEdit();
        },
        error: (error) => this.editError.set(error.error?.message || 'Post could not be saved.'),
      });
  }

  deletePost(post: MoviePost): void {
    if (!this.canManagePost(post)) {
      return;
    }

    this.openPostMenuId.set(null);
    if (!window.confirm('წავშალო ეს პოსტი?')) {
      return;
    }

    this.postsService.remove(post.id).subscribe({
      next: () => {
        this.posts.update((posts) => posts.filter((item) => item.id !== post.id));
        if (this.editingPostId() === post.id) {
          this.resetInlineEdit();
        }
      },
      error: (error) => this.error.set(error.error?.message || 'Post could not be deleted.'),
    });
  }

  toggleLike(post: MoviePost): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const shouldAnimate = !post.likedByMe;
    this.postsService.toggleLike(post.id).subscribe((updated) => {
      this.replacePost(updated);
      if (shouldAnimate && updated.likedByMe) {
        this.playLikeAnimation(post.id);
      }
    });
  }

  setCommentDraft(postId: string, value: string): void {
    this.commentDrafts.update((drafts) => ({ ...drafts, [postId]: value }));
  }

  addComment(post: MoviePost): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const text = (this.commentDrafts()[post.id] || '').trim();
    if (text.length < 2) {
      return;
    }

    this.postsService.addComment(post.id, text).subscribe((updated) => {
      this.replacePost(updated);
      this.commentDrafts.update((drafts) => ({ ...drafts, [post.id]: '' }));
    });
  }

  toggleCommentReaction(post: MoviePost, commentId: string): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    this.postsService.toggleCommentReaction(post.id, commentId).subscribe((updated) => this.replacePost(updated));
  }

  toggleReplyReaction(post: MoviePost, commentId: string, replyId: string): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    this.postsService.toggleCommentReplyReaction(post.id, commentId, replyId).subscribe((updated) => this.replacePost(updated));
  }

  replyKey(postId: string, commentId: string): string {
    return `${postId}:${commentId}`;
  }

  isReplyFormOpen(postId: string, commentId: string): boolean {
    return Boolean(this.openReplyForms()[this.replyKey(postId, commentId)]);
  }

  toggleReplyForm(postId: string, commentId: string): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const key = this.replyKey(postId, commentId);
    this.openReplyForms.update((forms) => ({ ...forms, [key]: !forms[key] }));
    window.requestAnimationFrame(() => document.getElementById(`reply-${postId}-${commentId}`)?.focus());
  }

  setReplyDraft(postId: string, commentId: string, value: string): void {
    this.replyDrafts.update((drafts) => ({ ...drafts, [this.replyKey(postId, commentId)]: value }));
  }

  addReply(post: MoviePost, commentId: string): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const key = this.replyKey(post.id, commentId);
    const text = (this.replyDrafts()[key] || '').trim();
    if (text.length < 2) {
      return;
    }

    this.postsService.addCommentReply(post.id, commentId, text).subscribe((updated) => {
      this.replacePost(updated);
      this.replyDrafts.update((drafts) => ({ ...drafts, [key]: '' }));
      this.openReplyForms.update((forms) => ({ ...forms, [key]: false }));
    });
  }

  focusComposer(): void {
    (document.getElementById('composer-title-input') ?? document.getElementById('composer-textarea'))?.focus();
  }

  focusComment(postId: string): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    window.requestAnimationFrame(() => document.getElementById(`comment-${postId}`)?.focus());
  }

  mediaTypeLabel(mediaType: SavedMediaItem['mediaType']): string {
    return mediaType === 'movie' ? 'ფილმი' : 'სერიალი';
  }

  composerMeta(): string {
    const parts = [];
    if (this.uploadedPhoto()) {
      parts.push('1 ფოტო');
    }
    if (this.selectedMedia().length) {
      parts.push(`${this.selectedMedia().length} მონიშნული სათაური`);
    }
    return parts.length ? parts.join(' · ') : 'შეგიძლია ფოტო და ფილმი/სერიალი მონიშნო';
  }

  isLikeAnimating(postId: string): boolean {
    return Boolean(this.likeAnimations()[postId]);
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const months = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month}, ${hours}:${minutes}`;
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

  private resetComposer(): void {
    this.postTitle = '';
    this.postBody = '';
    this.mediaQuery = '';
    this.mediaResults.set([]);
    this.selectedMedia.set([]);
    this.uploadedPhoto.set(null);
  }

  private resetInlineEdit(): void {
    this.editingPostId.set(null);
    this.editTitle = '';
    this.editContent = '';
    this.editError.set('');
  }

  private loadPosts(): void {
    this.loading.set(true);
    this.postsService.load().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
      },
      error: () => {
        this.posts.set([]);
        this.loading.set(false);
      },
    });
  }

  private replacePost(updated: MoviePost): void {
    this.posts.update((posts) => posts.map((post) => (post.id === updated.id ? updated : post)));
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

  private isSupportedImage(file: File): boolean {
    return file.type.startsWith('image/') || /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
  }
}
