import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedMediaResult } from '../models/media.models';
import { TmdbApiService } from './tmdb-api.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  constructor(private readonly tmdb: TmdbApiService) {}

  search(query: string, page = 1): Observable<PagedMediaResult> {
    return this.tmdb.search(query, page);
  }
}
