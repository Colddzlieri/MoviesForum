import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CastCardComponent } from '../../components/cast-card/cast-card.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MovieSliderComponent } from '../../components/movie-slider/movie-slider.component';
import { ReviewFormComponent, ReviewFormValue } from '../../components/review-form/review-form.component';
import { ReviewListComponent } from '../../components/review-list/review-list.component';
import { MediaDetails } from '../../core/models/media.models';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { LanguageService } from '../../core/services/language.service';
import { MovieService } from '../../core/services/movie.service';
import { ReviewService } from '../../core/services/review.service';
import { SeriesService } from '../../core/services/series.service';
import { TrailerModalService } from '../../core/services/trailer-modal.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { makeMediaKey, parseMediaRouteId } from '../../core/utils/media-key';

@Component({
  selector: 'app-details-page',
  imports: [DecimalPipe, RouterLink, CastCardComponent, MovieSliderComponent, ReviewFormComponent, ReviewListComponent, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="page-pad"><app-loading-skeleton [count]="8" /></div>
    } @else if (details(); as item) {
      <section
        class="details-hero"
        [style.--details-backdrop]="'url(' + item.backdropUrl + ')'"
      >
        <div class="details-hero-inner">
          <img class="details-poster" [src]="item.posterUrl" [alt]="item.title + ' poster'" />
          <div class="details-copy">
            <a routerLink="/movies" class="back-link">&larr; {{ lang.t('backToCatalog') }}</a>
            <h1>{{ item.title }}</h1>
            <p class="original-title">{{ lang.t('originalTitle') }}: {{ item.originalTitle }}</p>
            <p>{{ item.description }}</p>
            <div class="detail-facts">
              <span>&starf; {{ item.rating | number: '1.1-1' }} / 10</span>
              <span>{{ item.releaseYear || 'TBA' }}</span>
              <span>{{ item.duration }}</span>
              <span>{{ item.ageRating }}</span>
              <span>{{ item.mediaType === 'movie' ? lang.t('movie') : lang.t('tv') }}</span>
            </div>
            <div class="detail-actions">
              <button class="btn" type="button" (click)="openTrailer()" [disabled]="!item.trailerUrl">{{ lang.t('watchTrailer') }}</button>
              <button
                class="round-action"
                [class.active]="favorites.isFavorite(item)"
                type="button"
                (click)="favorites.toggle(item)"
                [attr.aria-label]="favorites.isFavorite(item) ? lang.t('removeFavorite') : lang.t('addFavorite')"
                [title]="favorites.isFavorite(item) ? lang.t('removeFavorite') : lang.t('addFavorite')"
              >
                &hearts;
              </button>
              <button
                class="round-action"
                [class.active]="watchlist.isListed(item)"
                type="button"
                (click)="watchlist.toggle(item)"
                [attr.aria-label]="watchlist.isListed(item) ? lang.t('removeWatchlist') : lang.t('addWatchlist')"
                [title]="watchlist.isListed(item) ? lang.t('removeWatchlist') : lang.t('addWatchlist')"
              >
                +
              </button>
            </div>
            @if (!item.trailerUrl) {
              <p class="muted">{{ lang.t('trailerUnavailable') }}</p>
            }
          </div>
        </div>
      </section>

      <section class="details-sections">
        <div class="info-grid">
          <span><b>{{ lang.t('genres') }}</b>{{ item.genres.join(', ') || lang.t('notListed') }}</span>
          <span><b>{{ lang.t('directorCreator') }}</b>{{ item.director }}</span>
          <span><b>{{ lang.t('cast') }}</b>{{ castNames(item) || lang.t('notListed') }}</span>
          <span><b>{{ lang.t('country') }}</b>{{ item.country }}</span>
          <span><b>{{ lang.t('language') }}</b>{{ item.language }}</span>
          <span><b>{{ lang.t('status') }}</b>{{ item.status || lang.t('released') }}</span>
        </div>
        @if (item.creators?.length || item.networks?.length) {
          <div class="info-grid">
            <span><b>{{ lang.t('creators') }}</b>{{ item.creators?.join(', ') || lang.t('notListed') }}</span>
            <span><b>{{ lang.t('networks') }}</b>{{ item.networks?.join(', ') || lang.t('notListed') }}</span>
          </div>
        }

        <h2>{{ lang.t('cast') }}</h2>
        <div class="cast-grid">
          @for (member of item.cast; track member.id) {
            <app-cast-card [member]="member" />
          }
        </div>

        <section class="details-review-panel">
          <section class="review-compose-card">
            <h2>{{ lang.t('writeReview') }}</h2>
            @if (auth.isLoggedIn()) {
              <app-review-form (reviewCreated)="addReview($event)" />
            } @else {
              <section class="auth-required">
                <p>{{ lang.t('needLogin') }}</p>
                <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
              </section>
            }
          </section>

          <section class="review-comments-card">
            <app-review-list
              [reviews]="reviews()"
              (remove)="removeReview($event)"
              (react)="reactReview($event)"
              (reply)="replyReview($event)"
              (replyReact)="reactReviewReply($event)"
            />
          </section>
        </section>

        @if (item.seasons?.length) {
          <h2>{{ lang.t('seasons') }}</h2>
          <div class="season-grid">
            @for (season of item.seasons; track season.id) {
              <article>
                <img [src]="season.posterUrl" [alt]="season.name" loading="lazy" />
                <strong>{{ season.name }}</strong>
                <span>{{ season.episodeCount }} {{ lang.t('episodes') }}</span>
              </article>
            }
          </div>
        }

        @if (item.recommendations.length) {
          <app-movie-slider [title]="lang.t('similarMovies')" [items]="item.recommendations" />
        }
      </section>
    } @else {
      <app-empty-state title="Media not found" message="The requested title could not be loaded." />
    }
  `,
})
export class DetailsPageComponent implements OnInit {
  readonly loading = signal(true);
  readonly details = signal<MediaDetails | null>(null);
  readonly mediaKey = signal('');
  readonly reviews = computed(() => this.reviewService.forMedia(this.mediaKey()));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly movies: MovieService,
    private readonly series: SeriesService,
    private readonly trailerModal: TrailerModalService,
    readonly favorites: FavoritesService,
    readonly watchlist: WatchlistService,
    readonly auth: AuthService,
    readonly lang: LanguageService,
    private readonly reviewService: ReviewService,
  ) {}

  ngOnInit(): void {
    const parsed = parseMediaRouteId(this.route.snapshot.paramMap.get('id'));
    if (!parsed) {
      this.loading.set(false);
      return;
    }

    this.mediaKey.set(makeMediaKey(parsed.mediaType, parsed.id));
    this.reviewService.load(this.mediaKey()).subscribe();
    const request = parsed.mediaType === 'movie' ? this.movies.details(parsed.id) : this.series.details(parsed.id);
    request.subscribe({
      next: (details) => {
        this.details.set(details);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openTrailer(): void {
    const item = this.details();
    if (item) {
      this.trailerModal.open(item.title, item.trailerUrl);
    }
  }

  addReview(review: ReviewFormValue): void {
    this.reviewService.add(this.mediaKey(), review).subscribe();
  }

  removeReview(id: string): void {
    this.reviewService.remove(this.mediaKey(), id).subscribe();
  }

  reactReview(id: string): void {
    this.reviewService.toggleReaction(this.mediaKey(), id).subscribe();
  }

  replyReview(event: { reviewId: string; text: string }): void {
    this.reviewService.addReply(this.mediaKey(), event.reviewId, event.text).subscribe();
  }

  reactReviewReply(event: { reviewId: string; replyId: string }): void {
    this.reviewService.toggleReplyReaction(this.mediaKey(), event.reviewId, event.replyId).subscribe();
  }

  castNames(item: MediaDetails): string {
    return item.cast
      .slice(0, 4)
      .map((member) => member.name)
      .join(', ');
  }
}
