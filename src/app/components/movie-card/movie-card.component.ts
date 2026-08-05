import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaItem } from '../../core/models/media.models';
import { FavoritesService } from '../../core/services/favorites.service';
import { LanguageService } from '../../core/services/language.service';
import { TrailerModalService } from '../../core/services/trailer-modal.service';
import { TmdbApiService } from '../../core/services/tmdb-api.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { makeMediaKey } from '../../core/utils/media-key';

@Component({
  selector: 'app-movie-card',
  imports: [RouterLink, DecimalPipe],
  template: `
    <article class="movie-card">
      <a [routerLink]="['/movie', mediaKey]" class="poster-link" [attr.aria-label]="item.title + ' დეტალები'">
        <img [src]="item.posterUrl" [alt]="item.title + ' poster'" loading="lazy" />
      </a>
      <div class="card-tools">
        <button type="button" [class.active]="favorites.isFavorite(item)" (click)="favorites.toggle(item)" aria-label="ფავორიტებში დამატება">&hearts;</button>
        <button type="button" [class.active]="watchlist.isListed(item)" (click)="watchlist.toggle(item)" aria-label="სანახავ სიაში დამატება">+</button>
      </div>
      <div class="movie-meta">
        <strong>{{ item.title }}</strong>
        <span>{{ item.releaseYear || 'უცნობი წელი' }} &middot; {{ item.mediaType === 'movie' ? lang.t('movies') : lang.t('series') }} &middot; &#9733; {{ item.rating | number: '1.1-1' }}</span>
        @if (item.matchPercent !== undefined) {
          <small class="match-percent">{{ item.matchPercent }}% დამთხვევა</small>
        }
      </div>
      <div class="card-hover">
        <p>{{ item.shortDescription }}</p>
        <div>
          <a [routerLink]="['/movie', mediaKey]" class="btn mini">{{ lang.t('details') }}</a>
          <button class="btn mini ghost" type="button" (click)="openTrailer()">თრეილერი</button>
        </div>
      </div>
    </article>
  `,
})
export class MovieCardComponent {
  @Input({ required: true }) item!: MediaItem;
  @Output() trailerRequested = new EventEmitter<MediaItem>();

  constructor(
    readonly favorites: FavoritesService,
    readonly watchlist: WatchlistService,
    readonly lang: LanguageService,
    private readonly modal: TrailerModalService,
    private readonly tmdb: TmdbApiService,
  ) {}

  get mediaKey(): string {
    return makeMediaKey(this.item.mediaType, this.item.id);
  }

  openTrailer(): void {
    this.trailerRequested.emit(this.item);
    this.tmdb.details(this.item.mediaType, this.item.id).subscribe({
      next: (details) => this.modal.open(details.title, details.trailerUrl),
      error: () => undefined,
    });
  }
}
