import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { Reel } from '../../core/models/reel.models';
import { AuthService } from '../../core/services/auth.service';
import { ReelsService } from '../../core/services/reels.service';

@Component({
  selector: 'app-reels-page',
  imports: [DatePipe, FormsModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="tiktok-reels-page">
      <header class="tiktok-reels-topbar">
        <div>
          <span>Cold</span>
          <h1>Reels</h1>
        </div>
        <button class="tiktok-upload-trigger" type="button" (click)="openUpload()">
          <span aria-hidden="true">+</span>
          ატვირთვა
        </button>
      </header>

      <main class="tiktok-feed" aria-label="ColdMovie Reels feed" (scroll)="syncActiveReel()">
        @if (loading()) {
          <div class="tiktok-feed-loader">
            <app-loading-skeleton [count]="4" />
          </div>
        } @else if (reels().length) {
          @for (reel of reels(); track reel.id; let i = $index) {
            <article #reelCard class="tiktok-reel-card">
              <button class="tiktok-video-hitbox" type="button" aria-label="ვიდეოს დაკვრა ან დაპაუზება" (click)="toggleVideo($event)">
                <video #reelVideo [src]="shouldLoadReel(i) ? reel.videoUrl : ''" muted playsinline loop preload="metadata"></video>
                <span class="tiktok-play-hint" aria-hidden="true">▶</span>
              </button>

              <div class="tiktok-video-shade" aria-hidden="true"></div>

              <div class="tiktok-reel-copy">
                <a class="tiktok-author" [routerLink]="['/users', reel.author.id]">
                  <span class="fb-avatar">
                    @if (reel.author.avatarUrl) {
                      <img [src]="reel.author.avatarUrl" [alt]="reel.author.name" />
                    } @else {
                      {{ initials(reel.author.name) }}
                    }
                  </span>
                  <span>
                    <b>{{ reel.author.name }}</b>
                    <small>{{ reel.createdAt | date: 'mediumDate' }}</small>
                  </span>
                </a>

                @if (reel.caption) {
                  <p>{{ reel.caption }}</p>
                }

                <div class="tiktok-sound-row">
                  <span aria-hidden="true">♪</span>
                  <b>{{ reel.videoName || 'ColdMovie reel' }}</b>
                </div>
              </div>

              <div class="tiktok-action-rail">
                <a class="tiktok-avatar-button" [routerLink]="['/users', reel.author.id]" aria-label="ავტორის პროფილი">
                  @if (reel.author.avatarUrl) {
                    <img [src]="reel.author.avatarUrl" [alt]="reel.author.name" />
                  } @else {
                    {{ initials(reel.author.name) }}
                  }
                </a>

                <button type="button" class="tiktok-like-button" [class.active]="reel.likedByMe" [class.like-burst]="isLikeAnimating(reel.id)" (click)="toggleLike(reel, $event)">
                  <span aria-hidden="true">♥</span>
                  <b>{{ reel.likeCount }}</b>
                </button>

                <button type="button" (click)="openComments(reel)">
                  <span aria-hidden="true">💬</span>
                  <b>{{ reel.commentCount }}</b>
                </button>

                <button type="button" (click)="shareReel(reel)">
                  <span aria-hidden="true">↗</span>
                  <b>Share</b>
                </button>

                @if (canRemove(reel)) {
                  <button type="button" class="danger" (click)="removeReel(reel)">
                    <span aria-hidden="true">×</span>
                    <b>წაშლა</b>
                  </button>
                }
              </div>
            </article>
          }
          <article class="tiktok-reel-card tiktok-end-card" aria-label="No more reels">
            <div class="tiktok-end-message">
              <span aria-hidden="true">✓</span>
              <h2>მეტი ვიდეო არ იძებნება</h2>
              <p>ახალი Reels როცა აიტვირთება, აქ გამოჩნდება.</p>
              <button class="tiktok-upload-trigger inline" type="button" (click)="openUpload()">
                <span aria-hidden="true">+</span>
                ატვირთვა
              </button>
            </div>
          </article>
        } @else {
          <section class="tiktok-empty">
            <app-empty-state title="რილსები ჯერ არ არის" message="ატვირთე პირველი მოკლე ვიდეო ColdMovie feed-ში." />
            <button class="btn" type="button" (click)="openUpload()">პირველი ვიდეოს ატვირთვა</button>
          </section>
        }
      </main>

      @if (commentsReel(); as reel) {
        <aside class="tiktok-comments-panel" aria-label="Reel comments">
          <header>
            <h2>კომენტარები</h2>
            <button type="button" aria-label="დახურვა" (click)="closeComments()">×</button>
          </header>

          <div class="tiktok-comments-list">
            @if (reel.comments.length) {
              @for (comment of reel.comments; track comment.id) {
                <article class="tiktok-comment">
                  <span class="fb-avatar">
                    @if (comment.author.avatarUrl) {
                      <img [src]="comment.author.avatarUrl" [alt]="comment.author.name" />
                    } @else {
                      {{ initials(comment.author.name) }}
                    }
                  </span>
                  <div>
                    <b>{{ comment.author.name }}</b>
                    <p>{{ comment.text }}</p>
                    <small>{{ comment.createdAt | date: 'short' }}</small>
                  </div>
                </article>
              }
            } @else {
              <p class="tiktok-comments-empty">ჯერ კომენტარი არ არის.</p>
            }
          </div>

          @if (auth.isLoggedIn()) {
            <form class="tiktok-comment-form" (ngSubmit)="addComment(reel)">
              <input
                [ngModel]="commentDraft(reel.id)"
                (ngModelChange)="setCommentDraft(reel.id, $event)"
                name="comment"
                maxlength="260"
                autocomplete="off"
                placeholder="დაამატე კომენტარი..."
              />
              <button type="submit">გაგზავნა</button>
            </form>
          } @else {
            <button class="btn" type="button" (click)="auth.open('login')">შესვლა კომენტარისთვის</button>
          }
        </aside>
      }

      @if (uploadOpen()) {
        <div class="reel-upload-modal" role="dialog" aria-modal="true" aria-label="Reel upload">
          @if (saving()) {
            <div class="publish-loading-overlay reel-publish-overlay" role="status" aria-live="polite">
              <div class="publish-loading-card">
                <span class="publish-loader-mark" aria-hidden="true"></span>
                <b>იტვირთება</b>
                <small>ვიდეო მუშავდება და ქვეყნდება...</small>
              </div>
            </div>
          }

          <form class="reel-upload-sheet" (ngSubmit)="publishReel()">
            <header>
              <div>
                <span>Upload</span>
                <h2>ახალი Reel</h2>
              </div>
              <button type="button" aria-label="დახურვა" (click)="closeUpload()">×</button>
            </header>

            <label class="tiktok-upload-drop" [class.has-preview]="videoPreview()">
              <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" (change)="uploadVideo($event)" />
              @if (videoPreview()) {
                <video [src]="videoPreview()" muted playsinline loop controls></video>
              } @else {
                <span aria-hidden="true">+</span>
                <b>ვიდეოს არჩევა</b>
                <small>MP4, WEBM, MOV · მაქს. 10MB</small>
              }
            </label>

            <label class="reel-caption-field">
              <span>წარწერა</span>
              <textarea [(ngModel)]="caption" name="caption" rows="3" maxlength="180" placeholder="რას აზიარებ ColdMovie-ზე?"></textarea>
            </label>

            @if (selectedVideoName()) {
              <p class="reel-file-name">{{ selectedVideoName() }}</p>
            }
            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }

            <div class="reel-upload-actions">
              <button class="btn ghost" type="button" (click)="clearDraft()">გასუფთავება</button>
              <button class="btn" type="submit" [disabled]="saving()">{{ saving() ? 'იტვირთება...' : 'გამოქვეყნება' }}</button>
            </div>
          </form>
        </div>
      }

      @if (shareMessage()) {
        <p class="tiktok-toast">{{ shareMessage() }}</p>
      }
    </section>
  `,
})
export class ReelsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('reelCard') private readonly reelCardRefs!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('reelVideo') private readonly reelVideoRefs!: QueryList<ElementRef<HTMLVideoElement>>;

  readonly reels = signal<Reel[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly uploadOpen = signal(false);
  readonly videoPreview = signal('');
  readonly selectedVideoName = signal('');
  readonly commentsOpenFor = signal('');
  readonly commentDrafts = signal<Record<string, string>>({});
  readonly shareMessage = signal('');
  readonly likeAnimating = signal<Record<string, boolean>>({});
  readonly pendingLikes = signal<Record<string, boolean>>({});
  readonly activeReelIndex = signal(0);

  caption = '';
  private videoDataUrl = '';
  private toastTimer = 0;
  private activeVideo: HTMLVideoElement | null = null;
  private soundUnlocked = false;
  private syncFrame = 0;
  private videoChangesSubscription?: { unsubscribe(): void };
  private cardChangesSubscription?: { unsubscribe(): void };
  private loadingVideoIds = new Set<string>();

  constructor(
    readonly auth: AuthService,
    private readonly reelsService: ReelsService,
  ) {}

  ngOnInit(): void {
    this.reelsService.load().subscribe({
      next: (reels) => {
        this.reels.set(reels);
        this.loading.set(false);
        this.queueActiveReelSync();
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit(): void {
    this.videoChangesSubscription = this.reelVideoRefs.changes.subscribe(() => this.queueActiveReelSync());
    this.cardChangesSubscription = this.reelCardRefs.changes.subscribe(() => this.queueActiveReelSync());
    this.queueActiveReelSync();
  }

  ngOnDestroy(): void {
    this.videoChangesSubscription?.unsubscribe();
    this.cardChangesSubscription?.unsubscribe();
    window.cancelAnimationFrame(this.syncFrame);
    this.pauseInactiveVideos(null);
  }

  commentsReel(): Reel | null {
    const id = this.commentsOpenFor();
    return this.reels().find((reel) => reel.id === id) || null;
  }

  openUpload(): void {
    if (!this.auth.requireLogin()) return;
    this.pauseInactiveVideos(null);
    this.uploadOpen.set(true);
  }

  closeUpload(): void {
    if (this.saving()) return;
    this.uploadOpen.set(false);
    this.queueActiveReelSync();
  }

  openComments(reel: Reel): void {
    this.commentsOpenFor.set(reel.id);
  }

  closeComments(): void {
    this.commentsOpenFor.set('');
  }

  uploadVideo(event: Event): void {
    this.error.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!this.isSupportedVideo(file)) {
      this.error.set('აირჩიე MP4, WEBM ან MOV ვიდეო.');
      input.value = '';
      return;
    }

    if (file.size > 10_000_000) {
      this.error.set('ვიდეო მაქსიმუმ 10MB უნდა იყოს.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:video/')) {
        this.error.set('ვიდეოს წაკითხვა ვერ მოხერხდა.');
        input.value = '';
        return;
      }

      this.videoDataUrl = result;
      this.videoPreview.set(result);
      this.selectedVideoName.set(file.name || 'coldmovie-reel');
      input.value = '';
    };
    reader.onerror = () => {
      this.error.set('ვიდეოს წაკითხვა ვერ მოხერხდა.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  publishReel(): void {
    this.error.set('');
    if (!this.auth.requireLogin()) return;
    if (!this.videoDataUrl) {
      this.error.set('ჯერ ვიდეო აირჩიე.');
      return;
    }

    this.saving.set(true);
    this.reelsService
      .create({
        caption: this.caption.trim(),
        videoUrl: this.videoDataUrl,
        videoName: this.selectedVideoName() || 'coldmovie-reel',
      })
      .subscribe({
        next: (reel) => {
          this.reels.update((reels) => [reel, ...reels.filter((item) => item.id !== reel.id)]);
          this.clearDraft();
          this.saving.set(false);
          this.uploadOpen.set(false);
          this.showToast('ვიდეო აიტვირთა');
          this.queueActiveReelSync();
        },
        error: (error) => {
          this.error.set(error.error?.message || 'რილსის ატვირთვა ვერ მოხერხდა.');
          this.saving.set(false);
        },
      });
  }

  toggleLike(reel: Reel, event?: Event): void {
    event?.stopPropagation();
    if (!this.auth.requireLogin()) return;
    if (this.pendingLikes()[reel.id]) return;

    const optimistic: Reel = {
      ...reel,
      likedByMe: !reel.likedByMe,
      likeCount: Math.max(0, reel.likeCount + (reel.likedByMe ? -1 : 1)),
    };
    this.replaceReel(optimistic);
    this.animateLike(reel.id);
    this.pendingLikes.update((items) => ({ ...items, [reel.id]: true }));

    this.reelsService.toggleLike(reel.id).subscribe({
      next: (updated) => {
        this.replaceReel(updated);
        this.pendingLikes.update((items) => ({ ...items, [reel.id]: false }));
      },
      error: () => {
        this.replaceReel(reel);
        this.pendingLikes.update((items) => ({ ...items, [reel.id]: false }));
        this.showToast('ლაიქი ვერ შეინახა');
      },
    });
  }

  addComment(reel: Reel): void {
    if (!this.auth.requireLogin()) return;
    const text = this.commentDraft(reel.id).trim();
    if (!text) return;

    this.reelsService.addComment(reel.id, text).subscribe((updated) => {
      this.replaceReel(updated);
      this.setCommentDraft(reel.id, '');
    });
  }

  async shareReel(reel: Reel): Promise<void> {
    const url = `${window.location.origin}/reels?reel=${encodeURIComponent(reel.id)}`;
    const shareData = {
      title: 'ColdMovie Reel',
      text: reel.caption || `${reel.author.name}-ის Reel`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      this.showToast('ლინკი დაკოპირდა');
    } catch {
      this.showToast('გაზიარება ვერ მოხერხდა');
    }
  }

  removeReel(reel: Reel): void {
    if (!this.canRemove(reel)) return;
    if (!window.confirm('წავშალო ეს რილსი?')) return;
    this.reelsService.remove(reel.id).subscribe(() => this.reels.update((reels) => reels.filter((item) => item.id !== reel.id)));
  }

  toggleVideo(event: Event): void {
    event.stopPropagation();
    const host = event.currentTarget as HTMLElement;
    const video = host.querySelector('video');
    if (!video) return;

    this.soundUnlocked = true;
    this.pauseInactiveVideos(video);
    this.activeVideo = video;

    if (video.paused) {
      video.muted = false;
      video.play().catch(() => undefined);
      host.classList.add('is-playing');
      return;
    }

    video.pause();
    host.classList.remove('is-playing');
  }

  syncActiveReel(): void {
    this.queueActiveReelSync();
  }

  shouldLoadReel(index: number): boolean {
    return Math.abs(index - this.activeReelIndex()) <= 1;
  }

  canRemove(reel: Reel): boolean {
    const user = this.auth.currentUser();
    return Boolean(user && (user.id === reel.author.id || user.role === 'admin'));
  }

  clearDraft(): void {
    this.caption = '';
    this.videoDataUrl = '';
    this.videoPreview.set('');
    this.selectedVideoName.set('');
    this.error.set('');
  }

  commentDraft(id: string): string {
    return this.commentDrafts()[id] || '';
  }

  setCommentDraft(id: string, value: string): void {
    this.commentDrafts.update((drafts) => ({ ...drafts, [id]: value }));
  }

  isLikeAnimating(id: string): boolean {
    return Boolean(this.likeAnimating()[id]);
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

  private replaceReel(updated: Reel): void {
    this.reels.update((reels) => reels.map((reel) => (reel.id === updated.id ? updated : reel)));
  }

  private showToast(message: string): void {
    window.clearTimeout(this.toastTimer);
    this.shareMessage.set(message);
    this.toastTimer = window.setTimeout(() => this.shareMessage.set(''), 2200);
  }

  private animateLike(id: string): void {
    this.likeAnimating.update((items) => ({ ...items, [id]: false }));
    window.setTimeout(() => this.likeAnimating.update((items) => ({ ...items, [id]: true })));
    window.setTimeout(() => this.likeAnimating.update((items) => ({ ...items, [id]: false })), 720);
  }

  private queueActiveReelSync(): void {
    window.cancelAnimationFrame(this.syncFrame);
    this.syncFrame = window.requestAnimationFrame(() => this.playVisibleReel());
  }

  private playVisibleReel(): void {
    const cards = this.reelCardRefs?.toArray().map((item) => item.nativeElement) || [];
    if (!cards.length || this.uploadOpen()) {
      this.pauseInactiveVideos(null);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (const [index, card] of cards.entries()) {
      const rect = card.getBoundingClientRect();
      const visiblePixels = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      if (visiblePixels <= 0) continue;

      const visibleRatio = visiblePixels / Math.max(rect.height, 1);
      const centerDistance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
      const score = visibleRatio * 1000 - centerDistance;
      if (visibleRatio >= 0.42 && score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex < 0) {
      this.pauseInactiveVideos(null);
      this.activeVideo = null;
      return;
    }

    this.activeReelIndex.set(bestIndex);
    this.loadNearbyVideos(bestIndex);
    window.setTimeout(() => this.playReelAt(bestIndex));
  }

  private playReelAt(index: number): void {
    const videos = this.reelVideoRefs?.toArray().map((item) => item.nativeElement) || [];
    const active = videos[index] || null;
    this.pauseInactiveVideos(active);
    if (!active) return;
    if (!active.src) {
      this.loadReelVideo(index, () => window.setTimeout(() => this.playReelAt(index)));
      return;
    }

    this.activeVideo = active;
    active.muted = !this.soundUnlocked;
    active.closest('.tiktok-video-hitbox')?.classList.add('is-playing');
    active.play().catch(() => {
      active.muted = true;
      active.play().catch(() => undefined);
    });
  }

  private pauseInactiveVideos(active: HTMLVideoElement | null): void {
    const videos = this.reelVideoRefs?.toArray().map((item) => item.nativeElement) || [];
    for (const video of videos) {
      if (video === active) continue;
      video.pause();
      video.muted = true;
      video.closest('.tiktok-video-hitbox')?.classList.remove('is-playing');
    }
  }

  private loadNearbyVideos(index: number): void {
    this.loadReelVideo(index);
    this.loadReelVideo(index - 1);
    this.loadReelVideo(index + 1);
  }

  private loadReelVideo(index: number, done?: () => void): void {
    const reel = this.reels()[index];
    if (!reel || reel.videoUrl || this.loadingVideoIds.has(reel.id)) {
      done?.();
      return;
    }

    this.loadingVideoIds.add(reel.id);
    this.reelsService.loadVideo(reel.id).subscribe({
      next: (updated) => {
        this.replaceReel(updated);
        this.loadingVideoIds.delete(reel.id);
        done?.();
      },
      error: () => {
        this.loadingVideoIds.delete(reel.id);
        done?.();
      },
    });
  }

  private isSupportedVideo(file: File): boolean {
    return /^video\/(mp4|webm|ogg|quicktime)$/i.test(file.type) || /\.(mp4|mov|webm|ogg)$/i.test(file.name);
  }
}
