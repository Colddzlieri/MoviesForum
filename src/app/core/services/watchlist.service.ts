import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { MediaItem, WatchStatus, WatchlistItem } from '../models/media.models';
import { makeMediaKey } from '../utils/media-key';
import { AuthService } from './auth.service';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly storage = inject(LocalStorageService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly store = this.storage.createSignal<Record<string, WatchlistItem>>('ColdMovie:watchlist', {});
  readonly items = this.store.state;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadFromServer();
      } else {
        this.store.set({});
      }
    });
  }

  isListed(item: Pick<MediaItem, 'id' | 'mediaType'>): boolean {
    return makeMediaKey(item.mediaType, item.id) in this.items();
  }

  toggle(item: MediaItem): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const key = makeMediaKey(item.mediaType, item.id);
    let nextItems: Record<string, WatchlistItem> = {};
    this.store.update((items) => {
      const next = { ...items };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = this.toWatchlist(item, 'Plan to Watch');
      }
      nextItems = next;
      return next;
    });
    this.persist(nextItems);
  }

  setStatus(item: WatchlistItem, status: WatchStatus): void {
    const key = makeMediaKey(item.mediaType, item.id);
    const next = { ...this.items(), [key]: { ...item, status } };
    this.store.set(next);
    this.persist(next);
  }

  remove(item: WatchlistItem): void {
    const key = makeMediaKey(item.mediaType, item.id);
    const next = { ...this.items() };
    delete next[key];
    this.store.set(next);
    this.persist(next);
  }

  clear(): void {
    this.store.set({});
    this.persist({});
  }

  private loadFromServer(): void {
    this.http
      .get<{ watchlist: Record<string, WatchlistItem> }>('/api/me/collections', { headers: this.auth.authHeaders() })
      .subscribe({
        next: (response) => this.store.set(response.watchlist || {}),
        error: () => undefined,
      });
  }

  private persist(items: Record<string, WatchlistItem>): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.put('/api/me/collections/watchlist', { items }, { headers: this.auth.authHeaders() }).subscribe({
      error: () => undefined,
    });
  }

  private toWatchlist(item: MediaItem, status: WatchStatus): WatchlistItem {
    return {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterUrl: item.posterUrl,
      releaseYear: item.releaseYear,
      rating: item.rating,
      status,
    };
  }
}
