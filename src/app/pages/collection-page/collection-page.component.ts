import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { FavoritesService } from '../../core/services/favorites.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { WatchStatus, WatchlistItem } from '../../core/models/media.models';
import { makeMediaKey } from '../../core/utils/media-key';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-collection-page',
  imports: [RouterLink, DecimalPipe, EmptyStateComponent],
  template: `
    <section class="page-hero small">
      <h1>{{ isWatchlist() ? lang.t('watchlist') : lang.t('favorites') }}</h1>
      <p>{{ isWatchlist() ? lang.t('addWatchlist') : lang.t('addFavorite') }}</p>
    </section>
    <section class="page-pad">
      @if (!auth.isLoggedIn()) {
        <section class="auth-required">
          <p>{{ lang.t('needLogin') }}</p>
          <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
        </section>
      } @else if (items().length) {
        <div class="collection-toolbar">
          <button class="btn ghost" type="button" (click)="clear()">{{ isWatchlist() ? lang.t('removeWatchlist') : lang.t('removeFavorite') }}</button>
        </div>
        <div class="media-grid">
          @for (item of items(); track item.mediaType + '-' + item.id; let index = $index) {
            <article class="saved-card grid-card-motion" [style.--card-order]="index">
              <a [routerLink]="['/movie', mediaKey(item.mediaType, item.id)]">
                <img [src]="item.posterUrl" [alt]="item.title + ' poster'" />
              </a>
              <strong>{{ item.title }}</strong>
              <span>{{ item.releaseYear || 'უცნობი წელი' }} · ★ {{ item.rating | number: '1.1-1' }}</span>
              @if (isWatchlist() && asWatchItem(item); as watchItem) {
                <select [value]="watchItem.status" (change)="setStatus(watchItem, $event)">
                  <option value="Plan to Watch">ვაპირებ ნახვას</option>
                  <option value="Watching">ვუყურებ</option>
                  <option value="Completed">ნანახია</option>
                </select>
                <button type="button" (click)="watchlist.remove(watchItem)">წაშლა</button>
              }
            </article>
          }
        </div>
      } @else {
        <app-empty-state [title]="isWatchlist() ? 'სანახავი სია ცარიელია' : 'ფავორიტები ჯერ არ გაქვს'" message="დაამატე სათაურები კატალოგიდან და ისინი აქ დარჩება." />
      }
    </section>
  `,
})
export class CollectionPageComponent implements OnInit {
  readonly isWatchlist = signal(false);
  readonly items = computed(() => (this.isWatchlist() ? Object.values(this.watchlist.items()) : Object.values(this.favorites.favorites())));

  constructor(
    private readonly route: ActivatedRoute,
    readonly favorites: FavoritesService,
    readonly watchlist: WatchlistService,
    readonly auth: AuthService,
    readonly lang: LanguageService,
  ) {}

  ngOnInit(): void {
    this.isWatchlist.set(this.route.snapshot.data['collection'] === 'watchlist');
  }

  mediaKey = makeMediaKey;

  clear(): void {
    if (this.isWatchlist()) {
      this.watchlist.clear();
    } else {
      this.favorites.clear();
    }
  }

  asWatchItem(item: unknown): WatchlistItem | null {
    const possible = item as Partial<WatchlistItem>;
    return possible.status ? (possible as WatchlistItem) : null;
  }

  setStatus(item: WatchlistItem, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as WatchStatus;
    this.watchlist.setStatus(item, status);
  }
}
