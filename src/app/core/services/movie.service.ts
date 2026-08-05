import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DiscoverFilters, MediaDetails, PagedMediaResult, SortOption } from '../models/media.models';
import { TmdbApiService } from './tmdb-api.service';

@Injectable({ providedIn: 'root' })
export class MovieService {
  constructor(private readonly tmdb: TmdbApiService) {}

  trending(): Observable<PagedMediaResult> {
    return this.tmdb.trending('movie');
  }

  popular(): Observable<PagedMediaResult> {
    return this.tmdb.list('/movie/popular', 'movie');
  }

  topRated(): Observable<PagedMediaResult> {
    return this.tmdb.list('/movie/top_rated', 'movie');
  }

  nowPlaying(): Observable<PagedMediaResult> {
    return this.tmdb.list('/movie/now_playing', 'movie');
  }

  upcoming(): Observable<PagedMediaResult> {
    return this.tmdb.list('/movie/upcoming', 'movie');
  }

  discover(filters: DiscoverFilters, page: number): Observable<PagedMediaResult> {
    return this.tmdb.discover('movie', {
      page,
      with_genres: filters.genreId,
      primary_release_year: filters.releaseYear,
      'vote_average.gte': filters.minRating,
      sort_by: this.sortValue(filters.sortBy),
    });
  }

  details(id: number): Observable<MediaDetails> {
    return this.tmdb.details('movie', id);
  }

  byGenre(genreId: number, page: number): Observable<PagedMediaResult> {
    return this.tmdb.discover('movie', { page, with_genres: genreId, sort_by: 'popularity.desc' });
  }

  private sortValue(sort: SortOption): string {
    const values: Record<SortOption, string> = {
      popularity: 'popularity.desc',
      rating: 'vote_average.desc',
      newest: 'primary_release_date.desc',
      oldest: 'primary_release_date.asc',
      titleAsc: 'original_title.asc',
      titleDesc: 'original_title.desc',
    };
    return values[sort];
  }
}
