import { DecimalPipe } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaItem } from '../../core/models/media.models';
import { LanguageService } from '../../core/services/language.service';
import { TmdbApiService } from '../../core/services/tmdb-api.service';
import { TrailerModalService } from '../../core/services/trailer-modal.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { makeMediaKey } from '../../core/utils/media-key';

@Component({
  selector: 'app-hero',
  imports: [RouterLink, DecimalPipe],
  template: `
    @if (activeItem; as movie) {
      <section class="hero cinematic-home-hero" [style.--hero-backdrop]="heroBackdrop(movie)">
        <div class="hero-content">
          <span class="eyebrow">{{ lang.t('featured') }} {{ movie.mediaType === 'movie' ? lang.t('movie') : lang.t('tv') }}</span>
          <h1>{{ movie.title }}</h1>
          <p>{{ movie.shortDescription }}</p>
          <div class="hero-facts">
            <span>★ {{ movie.rating | number: '1.1-1' }}</span>
            <span>{{ movie.releaseYear || 'TBA' }}</span>
            <span>{{ movie.genres.slice(0, 3).join(', ') || lang.t('trendingNow') }}</span>
          </div>
          <div class="hero-actions">
            <a class="btn" [routerLink]="['/movie', mediaKey(movie)]">{{ lang.t('details') }}</a>
            <button class="btn ghost" type="button" (click)="openTrailer(movie)">{{ lang.t('watchTrailer') }}</button>
            <button class="btn quiet" type="button" (click)="watchlist.toggle(movie)">
              {{ watchlist.isListed(movie) ? lang.t('removeWatchlist') : lang.t('addWatchlist') }}
            </button>
          </div>
        </div>

        <div class="hero-controls" aria-label="Featured controls">
          <button type="button" (click)="previous()" aria-label="Previous featured">‹</button>
          <button type="button" (click)="next()" aria-label="Next featured">›</button>
        </div>
      </section>
    }
  `,
})
export class HeroComponent {
  @Input() set items(value: MediaItem[]) {
    this.mediaItems = value;
    this.index.set(0);
  }

  protected mediaItems: MediaItem[] = [];
  protected readonly index = signal(0);

  constructor(
    readonly watchlist: WatchlistService,
    readonly lang: LanguageService,
    private readonly modal: TrailerModalService,
    private readonly tmdb: TmdbApiService,
  ) {}

  get activeItem(): MediaItem | null {
    return this.mediaItems[this.index()] ?? null;
  }

  next(): void {
    this.index.update((value) => (value + 1) % Math.max(this.mediaItems.length, 1));
  }

  previous(): void {
    this.index.update((value) => (value - 1 + this.mediaItems.length) % Math.max(this.mediaItems.length, 1));
  }

  mediaKey(item: MediaItem): string {
    return makeMediaKey(item.mediaType, item.id);
  }

  heroBackdrop(item: MediaItem): string {
    return `url("${item.backdropUrl}")`;
  }

  openTrailer(item: MediaItem): void {
    this.tmdb.details(item.mediaType, item.id).subscribe({
      next: (details) => this.modal.open(details.title, details.trailerUrl),
      error: () => undefined,
    });
  }
}
