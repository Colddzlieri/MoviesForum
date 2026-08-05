import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, shareReplay } from 'rxjs';
import { Genre, MediaType } from '../models/media.models';
import { TmdbApiService } from './tmdb-api.service';

@Injectable({ providedIn: 'root' })
export class GenreService {
  private readonly tmdb = inject(TmdbApiService);
  readonly genres$: Observable<Genre[]> = combineLatest([this.tmdb.genres(), this.tmdb.tvGenres()]).pipe(
    map(([movieGenres, tvGenres]) => {
      const byName = new Map<string, Genre>();
      [...movieGenres, ...tvGenres].forEach((genre) => byName.set(genre.name, genre));
      return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  byType(mediaType: MediaType): Observable<Genre[]> {
    return mediaType === 'movie' ? this.tmdb.genres() : this.tmdb.tvGenres();
  }
}
