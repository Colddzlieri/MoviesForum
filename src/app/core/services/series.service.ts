import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DiscoverFilters, MediaDetails, PagedMediaResult, SortOption } from '../models/media.models';
import { TmdbApiService } from './tmdb-api.service';

@Injectable({ providedIn: 'root' })
export class SeriesService {
  constructor(private readonly tmdb: TmdbApiService) {}

  trending(): Observable<PagedMediaResult> {
    return this.tmdb.trending('tv');
  }

  popular(): Observable<PagedMediaResult> {
    return this.tmdb.list('/tv/popular', 'tv');
  }

  topRated(): Observable<PagedMediaResult> {
    return this.tmdb.list('/tv/top_rated', 'tv');
  }

  onTheAir(): Observable<PagedMediaResult> {
    return this.tmdb.list('/tv/on_the_air', 'tv');
  }

  discover(filters: DiscoverFilters, page: number): Observable<PagedMediaResult> {
    return this.tmdb.discover('tv', {
      page,
      with_genres: filters.genreId,
      first_air_date_year: filters.releaseYear,
      'vote_average.gte': filters.minRating,
      sort_by: this.sortValue(filters.sortBy),
    });
  }

  details(id: number): Observable<MediaDetails> {
    return this.tmdb.details('tv', id);
  }

  byGenre(genreId: number, page: number): Observable<PagedMediaResult> {
    return this.tmdb.discover('tv', { page, with_genres: genreId, sort_by: 'popularity.desc' });
  }

  private sortValue(sort: SortOption): string {
    const values: Record<SortOption, string> = {
      popularity: 'popularity.desc',
      rating: 'vote_average.desc',
      newest: 'first_air_date.desc',
      oldest: 'first_air_date.asc',
      titleAsc: 'original_name.asc',
      titleDesc: 'original_name.desc',
    };
    return values[sort];
  }
}
