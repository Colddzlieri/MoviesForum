import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { SavedMediaItem } from '../../core/models/media.models';
import { PublicUserProfile } from '../../core/models/post.models';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { makeMediaKey } from '../../core/utils/media-key';

@Component({
  selector: 'app-user-profile-page',
  imports: [DatePipe, DecimalPipe, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  template: `
    @if (profile(); as data) {
      <section class="fb-profile-page">
        <div class="fb-profile-cover" [class.empty]="!data.user.bannerUrl">
          @if (data.user.bannerUrl) {
            <img [src]="data.user.bannerUrl" [alt]="data.user.name + ' ბანერი'" />
          } @else {
            <div class="fb-profile-cover-placeholder">
              <span>ColdMovie</span>
              <strong>{{ data.user.name }}</strong>
            </div>
          }

          @if (isOwnProfile(data.user.id)) {
            <div class="profile-banner-actions fb-cover-actions">
              <label class="btn ghost banner-upload">
                ბანერის შეცვლა
                <input type="file" accept="image/*" (change)="uploadBanner($event)" />
              </label>
              @if (data.user.bannerUrl) {
                <button class="btn quiet" type="button" (click)="removeBanner()">წაშლა</button>
              }
            </div>
          }
        </div>

        @if (bannerMessage()) {
          <p class="settings-message banner-message fb-banner-message" [class.error]="bannerError()">
            {{ bannerMessage() }}
          </p>
        }

        <div class="fb-profile-summary">
          <div class="fb-profile-avatar-wrap">
            @if (data.user.avatarUrl) {
              <img [src]="data.user.avatarUrl" [alt]="data.user.name" />
            } @else {
              <span>{{ initials(data.user.name) }}</span>
            }
          </div>

          <div class="fb-profile-info">
            <span class="settings-kicker">{{ data.user.role === 'admin' ? 'ColdMovie Admin' : 'ColdMovie Member' }}</span>
            <h1>{{ data.user.name }}</h1>
            <p>
              {{ data.user.stats.posts }} პოსტი · {{ data.user.stats.favorites }} ფავორიტი ·
              {{ data.user.stats.likes }} მოწონება
            </p>
          </div>

          <div class="fb-profile-actions">
            @if (isOwnProfile(data.user.id)) {
              <a class="btn" routerLink="/profile">პროფილის რედაქტირება</a>
            } @else {
              <a class="btn" routerLink="/">ლენტაზე დაბრუნება</a>
            }
          </div>
        </div>

        <nav class="fb-profile-tabs" aria-label="პროფილის სექციები">
          <a href="#profile-posts">პოსტები</a>
          <a href="#profile-favorites">ფავორიტები</a>
          <a href="#profile-about">ინფო</a>
        </nav>
      </section>

      <section class="fb-profile-content page-pad">
        <aside class="fb-profile-sidebar">
          <article class="fb-info-card" id="profile-about">
            <h2>ინფორმაცია</h2>
            <ul>
              <li>
                <span>სტატუსი</span>
                <b>{{ data.user.role === 'admin' ? 'ადმინისტრატორი' : 'მომხმარებელი' }}</b>
              </li>
              <li>
                <span>პოსტები</span>
                <b>{{ data.user.stats.posts }}</b>
              </li>
              <li>
                <span>კომენტარები</span>
                <b>{{ data.user.stats.comments }}</b>
              </li>
              <li>
                <span>პროფილი შექმნილია</span>
                <b>{{ data.user.createdAt ? (data.user.createdAt | date: 'mediumDate') : 'უცნობია' }}</b>
              </li>
            </ul>
          </article>

          <article class="fb-info-card" id="profile-favorites">
            <div class="fb-card-head">
              <div>
                <span class="settings-kicker">ფავორიტები</span>
                <h2>რჩეული ფილმები</h2>
              </div>
              <b>{{ data.favorites.length }}</b>
            </div>

            @if (data.favorites.length) {
              <div class="fb-favorite-list">
                @for (item of favoritePreview(data.favorites); track item.mediaType + '-' + item.id) {
                  <a [routerLink]="['/movie', mediaKey(item.mediaType, item.id)]">
                    <img [src]="item.posterUrl" [alt]="item.title" />
                    <span>
                      <b>{{ item.title }}</b>
                      <small>{{ item.releaseYear || 'TBA' }} · ★ {{ item.rating | number: '1.1-1' }}</small>
                    </span>
                  </a>
                }
              </div>
            } @else {
              <p class="fb-muted">ფავორიტები ჯერ არ აქვს დამატებული.</p>
            }
          </article>
        </aside>

        <main class="fb-profile-feed" id="profile-posts">
          @if (isOwnProfile(data.user.id)) {
            <section class="fb-composer-preview">
              <span class="mini-avatar">
                @if (data.user.avatarUrl) {
                  <img [src]="data.user.avatarUrl" [alt]="data.user.name" />
                } @else {
                  {{ initials(data.user.name) }}
                }
              </span>
              <a routerLink="/" class="fb-composer-link">რას ფიქრობ ფილმზე?</a>
            </section>
          }

          <div class="fb-feed-head">
            <h2>პოსტები</h2>
            <span>{{ data.posts.length }} ჩანაწერი</span>
          </div>

          @if (data.posts.length) {
            <div class="fb-post-list fb-user-posts">
              @for (post of data.posts; track post.id) {
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
                        <small>{{ post.createdAt | date: 'mediumDate' }}</small>
                      </div>
                    </a>
                  </header>

                  <div class="fb-post-body">
                    <h2>{{ post.title }}</h2>
                    <p>{{ post.content }}</p>
                  </div>

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
                            <small>{{ item.releaseYear || 'უცნობი წელი' }} · {{ item.mediaType === 'movie' ? 'ფილმი' : 'სერიალი' }} · ★ {{ item.rating || 'N/A' }}</small>
                          </span>
                          <i aria-hidden="true">›</i>
                        </a>
                      }
                    </div>
                  }

                  <div class="fb-post-stats">
                    <span>♥ {{ post.likeCount }} მოწონება</span>
                    <span>{{ post.commentCount }} კომენტარი</span>
                  </div>

                  <div class="fb-action-bar">
                    <a [routerLink]="['/posts', post.id]">
                      <span>□</span>
                      პოსტის გახსნა
                    </a>
                    <a [routerLink]="['/posts', post.id]">
                      <span>▱</span>
                      კომენტარი
                    </a>
                  </div>
                </article>
              }
            </div>
          } @else {
            <app-empty-state title="პოსტები ჯერ არ არის" message="ამ მომხმარებლის პოსტები აქ გამოჩნდება." />
          }
        </main>
      </section>
    } @else if (loading()) {
      <section class="page-pad"><app-loading-skeleton [count]="8" /></section>
    } @else {
      <section class="page-pad">
        <app-empty-state title="მომხმარებელი ვერ მოიძებნა" message="ეს პროფილი აღარ არსებობს ან ბმული არასწორია." />
      </section>
    }
  `,
})
export class UserProfilePageComponent implements OnInit {
  readonly profile = signal<PublicUserProfile | null>(null);
  readonly loading = signal(true);
  readonly bannerMessage = signal('');
  readonly bannerError = signal(false);
  readonly mediaKey = makeMediaKey;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly usersService: UsersService,
    readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.usersService.profile(id).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isOwnProfile(userId: string): boolean {
    return this.auth.currentUser()?.id === userId;
  }

  favoritePreview(items: SavedMediaItem[]): SavedMediaItem[] {
    return items.slice(0, 8);
  }

  uploadBanner(event: Event): void {
    this.bannerMessage.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isSupportedImage(file)) {
      this.setBannerMessage('აირჩიე სწორი სურათის ფაილი.', true);
      input.value = '';
      return;
    }

    if (file.size > 6_000_000) {
      this.setBannerMessage('ბანერის სურათი მაქსიმუმ 6MB უნდა იყოს.', true);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      this.auth.updateBanner(result || null).subscribe((error) => {
        this.setBannerMessage(error ?? 'ბანერი განახლდა.', Boolean(error));
        if (!error) {
          this.updateLocalBanner(result || undefined);
        }
        input.value = '';
      });
    };
    reader.onerror = () => {
      this.setBannerMessage('ბანერის წაკითხვა ვერ მოხერხდა.', true);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removeBanner(): void {
    this.auth.updateBanner(null).subscribe((error) => {
      this.setBannerMessage(error ?? 'ბანერი წაიშალა.', Boolean(error));
      if (!error) {
        this.updateLocalBanner(undefined);
      }
    });
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

  private updateLocalBanner(bannerUrl: string | undefined): void {
    this.profile.update((profile) => (profile ? { ...profile, user: { ...profile.user, bannerUrl } } : profile));
  }

  private setBannerMessage(message: string, isError: boolean): void {
    this.bannerError.set(isError);
    this.bannerMessage.set(message);
  }

  private isSupportedImage(file: File): boolean {
    return /^image\/(avif|gif|jpe?g|png|webp)$/i.test(file.type) || /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
  }
}
