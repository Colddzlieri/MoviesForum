import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { MediaItem, SavedMediaItem } from '../models/media.models';
import { makeMediaKey } from '../utils/media-key';
import { AuthService } from './auth.service';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly storage = inject(LocalStorageService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly store = this.storage.createSignal<Record<string, SavedMediaItem>>('ColdMovie:favorites', {});
  readonly favorites = this.store.state;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadFromServer();
      } else {
        this.store.set({});
      }
    });
  }

  isFavorite(item: Pick<MediaItem, 'id' | 'mediaType'>): boolean {
    return makeMediaKey(item.mediaType, item.id) in this.favorites();
  }

  toggle(item: MediaItem): void {
    if (!this.auth.requireLogin()) {
      return;
    }

    const key = makeMediaKey(item.mediaType, item.id);
    let nextItems: Record<string, SavedMediaItem> = {};
    this.store.update((items) => {
      const next = { ...items };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = this.toSaved(item);
      }
      nextItems = next;
      return next;
    });
    this.persist(nextItems);
  }

  clear(): void {
    this.store.set({});
    this.persist({});
  }

  private loadFromServer(): void {
    this.http
      .get<{ favorites: Record<string, SavedMediaItem> }>('/api/me/collections', { headers: this.auth.authHeaders() })
      .subscribe({
        next: (response) => this.store.set(response.favorites || {}),
        error: () => undefined,
      });
  }

  private persist(items: Record<string, SavedMediaItem>): void {
    if (!this.auth.isLoggedIn()) return;
    this.http.put('/api/me/collections/favorites', { items }, { headers: this.auth.authHeaders() }).subscribe({
      error: () => undefined,
    });
  }

  private toSaved(item: MediaItem): SavedMediaItem {
    return {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterUrl: item.posterUrl,
      releaseYear: item.releaseYear,
      rating: item.rating,
    };
  }
}
