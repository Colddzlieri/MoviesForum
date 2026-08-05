import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MoviePost } from '../../core/models/post.models';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { PostsService } from '../../core/services/posts.service';

@Component({
  selector: 'app-post-detail-page',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    @if (loading()) {
      <div class="page-pad"><app-loading-skeleton [count]="7" /></div>
    } @else if (post(); as item) {
      <section class="page-hero small post-detail-hero">
        <a routerLink="/posts" class="back-link">&larr; {{ text('პოსტები', 'Posts') }}</a>
        <span class="settings-kicker">{{ item.author.name }} · {{ item.createdAt | date: 'mediumDate' }}</span>
        <h1>{{ item.title }}</h1>
        <div class="post-stats hero-stats">
          <span>{{ item.viewCount }} {{ text('ნახვა', 'views') }}</span>
          <span [class.like-count-pop]="likeAnimating()">{{ item.likeCount }} {{ text('მოწონება', 'likes') }}</span>
          <span>{{ item.commentCount }} {{ text('კომენტარი', 'comments') }}</span>
        </div>
      </section>

      <section class="page-pad post-detail-layout">
        <article class="post-detail-card">
          <p>{{ item.content }}</p>
          @if (item.mediaItems.length) {
            <h2>{{ text('მონიშნული ფილმები', 'Tagged titles') }}</h2>
            <div class="post-media-strip large">
              @for (media of item.mediaItems; track media.mediaType + '-' + media.id) {
                <a [routerLink]="['/movie', media.mediaType + '-' + media.id]">
                  <img [src]="media.posterUrl" [alt]="media.title" />
                  <span>{{ media.title }}</span>
                </a>
              }
            </div>
          }
          <div class="post-detail-actions">
            <button class="btn like-button" type="button" (click)="toggleLike()" [disabled]="!auth.isLoggedIn()" [class.active]="item.likedByMe" [class.like-animate]="likeAnimating()">
              <span class="like-icon" aria-hidden="true">♥</span>
              <span class="like-ripple" aria-hidden="true"></span>
              <span class="like-spark spark-one" aria-hidden="true"></span>
              <span class="like-spark spark-two" aria-hidden="true"></span>
              <span class="like-spark spark-three" aria-hidden="true"></span>
              <span class="like-label">{{ item.likedByMe ? text('მოწონებულია', 'Liked') : text('მოწონება', 'Like') }}</span>
            </button>
            @if (!auth.isLoggedIn()) {
              <button class="btn ghost" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
            }
          </div>
        </article>

        <section class="comments-panel">
          <h2>{{ text('კომენტარები', 'Comments') }}</h2>
          @if (auth.isLoggedIn()) {
            <form class="comment-form" (ngSubmit)="addComment()">
              <textarea [(ngModel)]="comment" name="comment" rows="4" [placeholder]="text('დაწერე კომენტარი...', 'Write a comment...')"></textarea>
              <button class="btn" type="submit">{{ text('დამატება', 'Add') }}</button>
            </form>
          } @else {
            <section class="auth-required compact">
              <p>{{ text('კომენტარის დასაწერად შედი ანგარიშში.', 'Log in to comment.') }}</p>
              <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
            </section>
          }

          <div class="post-comments">
            @for (commentItem of item.comments; track commentItem.id) {
              <article class="post-comment-thread">
                <div class="post-comment-main">
                  <span class="fb-avatar sm">
                    @if (commentItem.author.avatarUrl) {
                      <img [src]="commentItem.author.avatarUrl" [alt]="commentItem.author.name" />
                    } @else {
                      {{ initials(commentItem.author.name) }}
                    }
                  </span>
                  <div class="post-comment-bubble">
                    <strong>{{ commentItem.author.name }}</strong>
                    <time>{{ commentItem.createdAt | date: 'medium' }}</time>
                    <p>{{ commentItem.text }}</p>
                    <div class="post-comment-actions">
                      <button type="button" [class.active]="commentItem.reactedByMe" (click)="toggleCommentReaction(commentItem.id)">♥ {{ commentItem.reactionCount || 0 }}</button>
                      <button type="button" (click)="toggleReplyForm(commentItem.id)">{{ text('პასუხი', 'Reply') }}</button>
                    </div>
                  </div>
                </div>

                @if (commentItem.replies?.length) {
                  <div class="post-comment-replies">
                    @for (reply of commentItem.replies; track reply.id) {
                      <article class="post-comment-reply">
                        <span class="reply-thread-label">პასუხი</span>
                        <span class="fb-avatar sm">
                          @if (reply.author.avatarUrl) {
                            <img [src]="reply.author.avatarUrl" [alt]="reply.author.name" />
                          } @else {
                            {{ initials(reply.author.name) }}
                          }
                        </span>
                        <div class="post-comment-bubble reply">
                          <strong>{{ reply.author.name }}</strong>
                          <time>{{ reply.createdAt | date: 'medium' }}</time>
                          <p>{{ reply.text }}</p>
                          <div class="post-comment-actions">
                            <button type="button" [class.active]="reply.reactedByMe" (click)="toggleReplyReaction(commentItem.id, reply.id)">♥ {{ reply.reactionCount || 0 }}</button>
                          </div>
                        </div>
                      </article>
                    }
                  </div>
                }

                @if (isReplyFormOpen(commentItem.id)) {
                  <form class="comment-form reply-comment-form" (ngSubmit)="addReply(commentItem.id)">
                    <textarea
                      [ngModel]="replyDrafts()[commentItem.id] || ''"
                      (ngModelChange)="setReplyDraft(commentItem.id, $event)"
                      [ngModelOptions]="{ standalone: true }"
                      rows="2"
                      [placeholder]="text('დაწერე პასუხი...', 'Write a reply...')"
                    ></textarea>
                    <button class="btn" type="submit">{{ text('პასუხი', 'Reply') }}</button>
                  </form>
                }
              </article>
            } @empty {
              <p class="muted">{{ text('კომენტარები ჯერ არ არის.', 'No comments yet.') }}</p>
            }
          </div>
        </section>
      </section>
    } @else {
      <app-empty-state title="Post not found" message="This post could not be loaded." />
    }
  `,
})
export class PostDetailPageComponent implements OnInit {
  readonly post = signal<MoviePost | null>(null);
  readonly loading = signal(true);
  readonly likeAnimating = signal(false);
  readonly replyDrafts = signal<Record<string, string>>({});
  readonly openReplyForms = signal<Record<string, boolean>>({});
  comment = '';
  private likeAnimationTimer: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    readonly auth: AuthService,
    readonly lang: LanguageService,
    private readonly posts: PostsService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.posts.get(id, true).subscribe({
      next: (post) => {
        this.post.set(post);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleLike(): void {
    const item = this.post();
    if (!item) return;
    if (!this.auth.requireLogin()) return;
    const shouldAnimate = !item.likedByMe;
    this.posts.toggleLike(item.id).subscribe((post) => {
      this.post.set(post);
      if (shouldAnimate && post.likedByMe) {
        this.playLikeAnimation();
      }
    });
  }

  addComment(): void {
    const item = this.post();
    const value = this.comment.trim();
    if (!item || value.length < 2) return;
    this.posts.addComment(item.id, value).subscribe((post) => {
      this.post.set(post);
      this.comment = '';
    });
  }

  toggleCommentReaction(commentId: string): void {
    const item = this.post();
    if (!item) return;
    if (!this.auth.requireLogin()) return;
    this.posts.toggleCommentReaction(item.id, commentId).subscribe((post) => this.post.set(post));
  }

  toggleReplyReaction(commentId: string, replyId: string): void {
    const item = this.post();
    if (!item) return;
    if (!this.auth.requireLogin()) return;
    this.posts.toggleCommentReplyReaction(item.id, commentId, replyId).subscribe((post) => this.post.set(post));
  }

  isReplyFormOpen(commentId: string): boolean {
    return Boolean(this.openReplyForms()[commentId]);
  }

  toggleReplyForm(commentId: string): void {
    if (!this.auth.requireLogin()) return;
    this.openReplyForms.update((forms) => ({ ...forms, [commentId]: !forms[commentId] }));
  }

  setReplyDraft(commentId: string, value: string): void {
    this.replyDrafts.update((drafts) => ({ ...drafts, [commentId]: value }));
  }

  addReply(commentId: string): void {
    const item = this.post();
    if (!item) return;
    if (!this.auth.requireLogin()) return;
    const text = (this.replyDrafts()[commentId] || '').trim();
    if (text.length < 2) return;
    this.posts.addCommentReply(item.id, commentId, text).subscribe((post) => {
      this.post.set(post);
      this.replyDrafts.update((drafts) => ({ ...drafts, [commentId]: '' }));
      this.openReplyForms.update((forms) => ({ ...forms, [commentId]: false }));
    });
  }

  text(ka: string, en: string): string {
    return this.lang.language() === 'ka' ? ka : en;
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

  private playLikeAnimation(): void {
    if (this.likeAnimationTimer) {
      window.clearTimeout(this.likeAnimationTimer);
    }

    this.likeAnimating.set(true);
    this.likeAnimationTimer = window.setTimeout(() => {
      this.likeAnimating.set(false);
      this.likeAnimationTimer = null;
    }, 780);
  }
}
