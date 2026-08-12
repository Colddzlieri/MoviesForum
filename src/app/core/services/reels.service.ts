import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';
import { Reel, ReelPayload } from '../models/reel.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ReelsService {
  private readonly reelsState = signal<Reel[]>([]);
  readonly reels = this.reelsState.asReadonly();

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  load(): Observable<Reel[]> {
    return this.http.get<{ reels: Reel[] }>('/api/reels', { headers: this.headers() }).pipe(
      map((response) => response.reels.map((reel) => ({ ...reel, videoUrl: reel.videoUrl || '' }))),
      tap((reels) => this.reelsState.set(reels)),
    );
  }

  create(payload: ReelPayload): Observable<Reel> {
    return this.http.post<{ reel: Reel }>('/api/reels', payload, { headers: this.headers() }).pipe(
      map((response) => response.reel),
      tap((reel) => this.reelsState.update((reels) => [reel, ...reels])),
    );
  }

  toggleLike(id: string): Observable<Reel> {
    return this.http.post<{ reel: Partial<Reel> & Pick<Reel, 'id'> }>(`/api/reels/${id}/like`, {}, { headers: this.headers() }).pipe(
      map((response) => this.mergeReel(response.reel)),
      tap((reel) => this.replace(reel)),
    );
  }

  addComment(id: string, text: string): Observable<Reel> {
    return this.http.post<{ reel: Partial<Reel> & Pick<Reel, 'id'> }>(`/api/reels/${id}/comments`, { text }, { headers: this.headers() }).pipe(
      map((response) => this.mergeReel(response.reel)),
      tap((reel) => this.replace(reel)),
    );
  }

  loadVideo(id: string): Observable<Reel> {
    const current = this.reelsState().find((reel) => reel.id === id);
    if (current?.videoUrl) {
      return of(current);
    }

    return this.http.get<{ id: string; videoUrl: string }>(`/api/reels/${id}/video`, { headers: this.headers() }).pipe(
      map((response) => this.mergeReel({ id: response.id, videoUrl: response.videoUrl })),
      tap((reel) => this.replace(reel)),
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/reels/${id}`, { headers: this.headers() }).pipe(tap(() => this.reelsState.update((reels) => reels.filter((reel) => reel.id !== id))));
  }

  private replace(updated: Reel): void {
    this.reelsState.update((reels) => reels.map((reel) => (reel.id === updated.id ? { ...reel, ...updated } : reel)));
  }

  private mergeReel(updated: Partial<Reel> & Pick<Reel, 'id'>): Reel {
    const current = this.reelsState().find((reel) => reel.id === updated.id);
    return { ...(current as Reel), ...updated };
  }

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.authHeaders());
  }
}
