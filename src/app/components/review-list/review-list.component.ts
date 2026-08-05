import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Review, ReviewReply } from '../../core/models/media.models';
import { AuthService } from '../../core/services/auth.service';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

@Component({
  selector: 'app-review-list',
  imports: [DatePipe, FormsModule, RatingStarsComponent],
  template: `
    <div class="review-list cinematic-review-list">
      <header class="review-list-title">
        <div>
          <span class="settings-kicker">კომენტარები</span>
          <h3>მაყურებლების შეფასებები</h3>
        </div>
        <strong>{{ reviews.length }}</strong>
      </header>

      @for (review of reviews; track review.id) {
        <article class="review-card social-review-card">
          <div class="review-avatar" aria-hidden="true">
            @if (review.avatarUrl) {
              <img [src]="review.avatarUrl" [alt]="review.name" />
            } @else {
              <span>{{ initials(review.name) }}</span>
            }
          </div>
          <div class="review-body">
            <div class="review-head">
              <div>
                <strong>{{ review.name }}</strong>
                <span>{{ review.createdAt | date: 'mediumDate' }}</span>
              </div>
              <app-rating-stars [rating]="review.rating" />
            </div>
            <p>{{ review.text }}</p>

            <div class="review-actions">
              <button type="button" [class.active]="review.reactedByMe" (click)="react.emit(review.id)">
                ♥ {{ review.reactionCount || 0 }}
              </button>
              <button type="button" (click)="toggleReply(review.id)">პასუხი</button>
              @if (canRemove(review)) {
                <button type="button" class="danger-link" (click)="remove.emit(review.id)">წაშლა</button>
              }
            </div>

            @if (isReplyOpen(review.id)) {
              @if (auth.isLoggedIn()) {
                <form class="review-reply-form" (ngSubmit)="submitReply(review.id)">
                  <input
                    [ngModel]="replyDrafts()[review.id] || ''"
                    (ngModelChange)="setReplyDraft(review.id, $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="დაწერე პასუხი..."
                  />
                  <button type="submit">გაგზავნა</button>
                </form>
              } @else {
                <button type="button" class="review-login-reply" (click)="auth.open('login')">პასუხისთვის შედი ანგარიშში</button>
              }
            }

            @if (reviewReplies(review).length) {
              <div class="review-replies" aria-label="პასუხები">
                @for (replyItem of reviewReplies(review); track replyItem.id) {
                  <article class="review-reply-card">
                    <div class="reply-marker">პასუხი</div>
                    <div class="review-avatar tiny" aria-hidden="true">
                      @if (replyItem.avatarUrl) {
                        <img [src]="replyItem.avatarUrl" [alt]="replyItem.name" />
                      } @else {
                        <span>{{ initials(replyItem.name) }}</span>
                      }
                    </div>
                    <div class="review-reply-body">
                      <strong>{{ replyItem.name }}</strong>
                      <small>{{ replyItem.createdAt | date: 'mediumDate' }}</small>
                      <p>{{ replyItem.text }}</p>
                      <button type="button" [class.active]="replyItem.reactedByMe" (click)="replyReact.emit({ reviewId: review.id, replyId: replyItem.id })">
                        ♥ {{ replyItem.reactionCount || 0 }}
                      </button>
                    </div>
                  </article>
                }
              </div>
            }
          </div>
        </article>
      } @empty {
        <p class="muted">კომენტარები ჯერ არ არის. პირველმა გაუზიარე შთაბეჭდილება.</p>
      }
    </div>
  `,
})
export class ReviewListComponent {
  @Input() reviews: Review[] = [];
  @Output() remove = new EventEmitter<string>();
  @Output() react = new EventEmitter<string>();
  @Output() reply = new EventEmitter<{ reviewId: string; text: string }>();
  @Output() replyReact = new EventEmitter<{ reviewId: string; replyId: string }>();
  readonly auth = inject(AuthService);
  readonly replyDrafts = signal<Record<string, string>>({});
  readonly openReplyForms = signal<Record<string, boolean>>({});

  reviewReplies(review: Review): ReviewReply[] {
    return review.replies ?? [];
  }

  isReplyOpen(reviewId: string): boolean {
    return Boolean(this.openReplyForms()[reviewId]);
  }

  toggleReply(reviewId: string): void {
    this.openReplyForms.update((forms) => ({ ...forms, [reviewId]: !forms[reviewId] }));
  }

  setReplyDraft(reviewId: string, value: string): void {
    this.replyDrafts.update((drafts) => ({ ...drafts, [reviewId]: value }));
  }

  submitReply(reviewId: string): void {
    const text = (this.replyDrafts()[reviewId] || '').trim();
    if (text.length < 2) {
      return;
    }

    this.reply.emit({ reviewId, text });
    this.replyDrafts.update((drafts) => ({ ...drafts, [reviewId]: '' }));
    this.openReplyForms.update((forms) => ({ ...forms, [reviewId]: false }));
  }

  canRemove(review: Review): boolean {
    const user = this.auth.currentUser();
    return Boolean(user && (this.auth.isAdmin() || review.userId === user.id || (!review.userId && review.name === user.name)));
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'CM';
  }
}
