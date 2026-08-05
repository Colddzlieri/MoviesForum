import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, timeout } from 'rxjs';
import { MediaItem } from '../models/media.models';

interface WikiSearchResponse {
  query?: {
    search?: Array<{ title: string; snippet?: string }>;
  };
}

interface WikiExtractResponse {
  query?: {
    pages?: Record<string, { extract?: string; title?: string }>;
  };
}

interface WikiParseSectionsResponse {
  parse?: {
    sections?: Array<{ index: string; line: string }>;
  };
}

interface WikiParseTextResponse {
  parse?: {
    text?: {
      '*': string;
    };
  };
}

@Injectable({ providedIn: 'root' })
export class PlotEnrichmentService {
  private readonly cache = new Map<string, Observable<string>>();

  constructor(private readonly http: HttpClient) {}

  candidateTitlesFor(queries: string[]): Observable<string[]> {
    const cleanedQueries = [...new Set(queries.map((query) => query.trim()).filter((query) => query.length >= 4))].slice(0, 6);
    if (!cleanedQueries.length) {
      return of([]);
    }

    return forkJoin(cleanedQueries.flatMap((query) => this.looseQueryVariants(query).map((variant) => this.searchLooseTitles(variant)))).pipe(
      map((groups) =>
        [...new Set(groups.flat().flatMap((title) => [title, this.cleanCandidateTitle(title)]).filter((title) => title.length >= 2))]
          .slice(0, 36),
      ),
      timeout({ first: 4500 }),
      catchError(() => of([])),
    );
  }

  private looseQueryVariants(query: string): string[] {
    return [
      query,
      `${query} plot`,
      `${query} synopsis`,
      `${query} story`,
      `${query} premise`,
      `${query} film`,
      `${query} movie`,
    ].slice(0, 7);
  }

  plotTextFor(item: MediaItem): Observable<string> {
    const key = `${item.mediaType}-${item.id}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const queries = this.queriesFor(item);
    const request = forkJoin(queries.map((query) => this.searchTitles(query, item))).pipe(
      map((titleGroups) => titleGroups.flat()),
      map((titles) => [...new Set(titles)].slice(0, 8)),
      switchMap((uniqueTitles) => {
        if (!uniqueTitles.length) {
          return of('');
        }
        return forkJoin(uniqueTitles.map((title) => this.extract(title))).pipe(
          map((extracts) =>
            extracts
              .filter((extract) => extract.length >= 120)
              .sort((a, b) => b.length - a.length)
              .slice(0, 4)
              .join(' '),
          ),
        );
      }),
      map((plot) => plot.replace(/\s+/g, ' ').trim().toLowerCase()),
      timeout({ first: 5500 }),
      catchError(() => of('')),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.cache.set(key, request);
    return request;
  }

  private queriesFor(item: MediaItem): string[] {
    const title = item.originalTitle || item.title;
    const year = item.releaseYear ? `${item.releaseYear}` : '';
    const type = item.mediaType === 'tv' ? 'TV series' : 'film';
    const animated = item.genreIds.includes(16) || item.genres.some((genre) => /animation|anime|cartoon/i.test(genre));
    return [
      `${title} ${year} ${type}`,
      `${title} ${year} ${type} plot`,
      `${title} ${type}`,
      `${title} ${type} plot`,
      animated ? `${title} animated film plot` : '',
      animated ? `${title} animation plot` : '',
      `${title} ${year}`,
      title,
    ].filter((query) => query.trim().length > 2);
  }

  private searchTitles(query: string, item: MediaItem): Observable<string[]> {
    return this.http
      .get<WikiSearchResponse>('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: query,
          format: 'json',
          origin: '*',
          srlimit: 5,
        },
      })
      .pipe(
        map((response) => (response.query?.search ?? []).map((result) => result.title).filter((title) => this.isRelevantTitle(title, item))),
        catchError(() => of([])),
      );
  }

  private searchLooseTitles(query: string): Observable<string[]> {
    return this.http
      .get<WikiSearchResponse>('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          list: 'search',
          srsearch: `${query} film OR movie OR television series OR animated plot`,
          format: 'json',
          origin: '*',
          srlimit: 5,
        },
      })
      .pipe(
        map((response) =>
          (response.query?.search ?? [])
            .map((result) => result.title)
            .filter((title) => /film|movie|series|television|tv|animation|anime/i.test(title) || !/list of|category:|template:/i.test(title)),
        ),
        catchError(() => of([])),
      );
  }

  private cleanCandidateTitle(title: string): string {
    return title
      .replace(/\s*\((film|movie|tv series|television series|series|anime|animation|franchise|soundtrack|musical)\)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isRelevantTitle(title: string, item: MediaItem): boolean {
    const normalizedTitle = title.toLowerCase();
    const mainTitle = (item.originalTitle || item.title).toLowerCase();
    const simpleMain = mainTitle.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const simpleWiki = normalizedTitle.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const titleTokens = simpleMain.split(' ').filter((token) => token.length >= 3);
    const overlap = titleTokens.filter((token) => simpleWiki.includes(token)).length;
    const hasTypeHint = item.mediaType === 'tv' ? /tv|series|television/.test(normalizedTitle) : /film|movie|animated|animation/.test(normalizedTitle);
    return simpleWiki.includes(simpleMain) || overlap >= Math.min(2, titleTokens.length) || hasTypeHint;
  }

  private extract(title: string): Observable<string> {
    return forkJoin({
      plotSections: this.extractPlotSections(title),
      fullExtract: this.extractFullArticle(title),
    }).pipe(
      map(({ plotSections, fullExtract }) => [plotSections, fullExtract].filter(Boolean).join(' ')),
      catchError(() => of('')),
    );
  }

  private extractFullArticle(title: string): Observable<string> {
    return this.http
      .get<WikiExtractResponse>('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          prop: 'extracts',
          exintro: '0',
          explaintext: '1',
          redirects: '1',
          titles: title,
          format: 'json',
          origin: '*',
        },
      })
      .pipe(
        map((response) => {
          const pages = Object.values(response.query?.pages ?? {});
          return pages[0]?.extract ?? '';
        }),
        catchError(() => of('')),
      );
  }

  private extractPlotSections(title: string): Observable<string> {
    return this.http
      .get<WikiParseSectionsResponse>('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'parse',
          page: title,
          prop: 'sections',
          redirects: '1',
          format: 'json',
          origin: '*',
        },
      })
      .pipe(
        map((response) =>
          (response.parse?.sections ?? [])
            .filter((section) => /plot|synopsis|premise|story|narrative|episodes/i.test(section.line))
            .map((section) => section.index)
            .slice(0, 4),
        ),
        switchMap((sectionIndexes) => {
          if (!sectionIndexes.length) {
            return of('');
          }
          return forkJoin(sectionIndexes.map((section) => this.extractSection(title, section))).pipe(
            map((sections) => sections.filter((section) => section.length >= 80).join(' ')),
          );
        }),
        catchError(() => of('')),
      );
  }

  private extractSection(title: string, section: string): Observable<string> {
    return this.http
      .get<WikiParseTextResponse>('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'parse',
          page: title,
          prop: 'text',
          section,
          redirects: '1',
          format: 'json',
          origin: '*',
        },
      })
      .pipe(
        map((response) => this.htmlToText(response.parse?.text?.['*'] ?? '')),
        catchError(() => of('')),
      );
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<sup[\s\S]*?<\/sup>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
