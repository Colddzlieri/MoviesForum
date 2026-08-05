import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { Review } from '../models/media.models';
import { AuthService } from './auth.service';
import { LocalStorageService } from './local-storage.service';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(LocalStorageService);
  private readonly auth = inject(AuthService);
  private readonly store = this.storage.createSignal<Record<string, Review[]>>('ColdMovie:reviews', {});
  readonly reviews = this.store.state;

  forMedia(mediaKey: string): Review[] {
    return this.reviews()[mediaKey] ?? [];
  }

  load(mediaKey: string): Observable<Review[]> {
    return this.http.get<{ reviews: Review[] }>(`/api/reviews/${mediaKey}`, { headers: this.headers() }).pipe(
      map((response) => response.reviews),
      tap((reviews) => this.setMediaReviews(mediaKey, reviews)),
    );
  }

  add(mediaKey: string, review: Omit<Review, 'id' | 'mediaKey' | 'createdAt' | 'name' | 'avatarUrl'>): Observable<Review | null> {
    if (!this.auth.requireLogin()) {
      return of(null);
    }

    return this.http.post<{ review: Review }>(`/api/reviews/${mediaKey}`, review, { headers: this.headers() }).pipe(
      map((response) => response.review),
      tap((nextReview) => {
        this.store.update((allReviews) => ({
          ...allReviews,
          [mediaKey]: [nextReview, ...(allReviews[mediaKey] ?? [])],
        }));
      }),
    );
  }

  remove(mediaKey: string, reviewId: string): Observable<void> {
    return this.http.delete<void>(`/api/reviews/${mediaKey}/${reviewId}`, { headers: this.headers() }).pipe(
      tap(() => {
        this.store.update((allReviews) => ({
          ...allReviews,
          [mediaKey]: (allReviews[mediaKey] ?? []).filter((review) => review.id !== reviewId),
        }));
      }),
    );
  }

  toggleReaction(mediaKey: string, reviewId: string): Observable<Review[]> {
    if (!this.auth.requireLogin()) {
      return of(this.forMedia(mediaKey));
    }

    return this.http.post<{ reviews: Review[] }>(`/api/reviews/${mediaKey}/${reviewId}/react`, {}, { headers: this.headers() }).pipe(
      map((response) => response.reviews),
      tap((reviews) => this.setMediaReviews(mediaKey, reviews)),
    );
  }

  addReply(mediaKey: string, reviewId: string, text: string): Observable<Review[]> {
    if (!this.auth.requireLogin()) {
      return of(this.forMedia(mediaKey));
    }

    return this.http.post<{ reviews: Review[] }>(`/api/reviews/${mediaKey}/${reviewId}/replies`, { text }, { headers: this.headers() }).pipe(
      map((response) => response.reviews),
      tap((reviews) => this.setMediaReviews(mediaKey, reviews)),
    );
  }

  toggleReplyReaction(mediaKey: string, reviewId: string, replyId: string): Observable<Review[]> {
    if (!this.auth.requireLogin()) {
      return of(this.forMedia(mediaKey));
    }

    return this.http.post<{ reviews: Review[] }>(`/api/reviews/${mediaKey}/${reviewId}/replies/${replyId}/react`, {}, { headers: this.headers() }).pipe(
      map((response) => response.reviews),
      tap((reviews) => this.setMediaReviews(mediaKey, reviews)),
    );
  }

  private setMediaReviews(mediaKey: string, reviews: Review[]): void {
    this.store.update((allReviews) => ({
      ...allReviews,
      [mediaKey]: reviews,
    }));
  }

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.authHeaders());
  }
}
