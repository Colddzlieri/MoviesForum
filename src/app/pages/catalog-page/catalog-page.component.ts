import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FilterPanelComponent } from '../../components/filter-panel/filter-panel.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MovieCardComponent } from '../../components/movie-card/movie-card.component';
import { DiscoverFilters, Genre, MediaItem, MediaType } from '../../core/models/media.models';
import { GenreService } from '../../core/services/genre.service';
import { LanguageService } from '../../core/services/language.service';
import { MovieService } from '../../core/services/movie.service';
import { SearchService } from '../../core/services/search.service';
import { SeriesService } from '../../core/services/series.service';

@Component({
  selector: 'app-catalog-page',
  imports: [FilterPanelComponent, MovieCardComponent, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    <section class="catalog-hero" [class.series-mode]="filters().mediaType === 'tv'">
      <div class="catalog-hero-copy">
        <span class="settings-kicker">{{ heroKicker() }}</span>
        <h1>{{ title() }}</h1>
        <p>{{ heroCopy() }}</p>
        <div class="catalog-hero-facts">
          <span>{{ lang.language() === 'ka' ? 'ახალი აღმოჩენები' : 'Fresh discoveries' }}</span>
          <span>{{ lang.language() === 'ka' ? 'შერჩეული კოლექციები' : 'Curated collections' }}</span>
          <span>{{ lang.language() === 'ka' ? 'სწრაფი ფილტრები' : 'Smart filters' }}</span>
        </div>
      </div>
    </section>
    <section class="page-pad catalog-pad">
      <app-filter-panel [filters]="filters()" [genres]="genres()" (filtersChange)="applyFilters($event)" />
      @if (loading()) {
        <app-loading-skeleton [count]="16" />
      } @else if (items().length) {
        <div class="catalog-results-bar">
          <div>
            <span class="settings-kicker">{{ lang.language() === 'ka' ? 'შედეგები' : 'Results' }}</span>
            <strong>{{ resultTitle() }}</strong>
          </div>
          <p>{{ resultCopy() }}</p>
        </div>
        <div class="media-grid catalog-grid">
          @for (item of items(); track item.mediaType + '-' + item.id; let index = $index) {
            <app-movie-card class="grid-card-motion" [style.--card-order]="index" [item]="item" />
          }
        </div>
        @if (totalPages() > 1) {
          <nav class="pagination" aria-label="კატალოგის გვერდები">
            <button type="button" [disabled]="page() === 1" (click)="goToPage(page() - 1)">‹</button>
            @for (pageNumber of visiblePages(); track pageNumber) {
              <button type="button" [class.active]="pageNumber === page()" (click)="goToPage(pageNumber)">{{ pageNumber }}</button>
            }
            <button type="button" [disabled]="page() >= totalPages()" (click)="goToPage(page() + 1)">›</button>
          </nav>
        }
      } @else {
        <app-empty-state title="სათაური ვერ მოიძებნა" message="სცადე სხვა ჟანრი, წელი, რეიტინგი ან საძიებო სიტყვა." />
      }
    </section>
  `,
})
export class CatalogPageComponent implements OnInit {
  readonly itemsPerView = 70;
  private readonly tmdbPagesPerView = 4;
  readonly title = signal('ფილმები');
  readonly loading = signal(false);
  readonly items = signal<MediaItem[]>([]);
  readonly genres = signal<Genre[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly visiblePages = computed(() => {
    const total = Math.min(this.totalPages(), 500);
    const current = this.page();
    const start = Math.max(1, Math.min(current - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  readonly filters = signal<DiscoverFilters>({
    mediaType: 'movie',
    query: '',
    genreId: null,
    releaseYear: null,
    minRating: null,
    sortBy: 'popularity',
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly movies: MovieService,
    private readonly series: SeriesService,
    private readonly search: SearchService,
    private readonly genreService: GenreService,
    readonly lang: LanguageService,
  ) {}

  ngOnInit(): void {
    const dataType = this.route.snapshot.data['mediaType'] as MediaType | undefined;
    const genreParam = this.route.snapshot.paramMap.get('genre');
    const initialType = dataType ?? 'all';
    this.title.set(dataType === 'tv' ? this.lang.t('series') : genreParam ? this.lang.t('genres') : this.lang.t('movies'));
    this.filters.update((filters) => ({
      ...filters,
      mediaType: initialType,
      genreId: genreParam && Number.isFinite(Number(genreParam)) ? Number(genreParam) : null,
    }));
    this.genreService.genres$.subscribe((genres) => this.genres.set(genres));
    this.load(true);
  }

  applyFilters(filters: DiscoverFilters): void {
    this.filters.set(filters);
    this.load(true);
  }

  heroKicker(): string {
    if (this.lang.language() === 'ka') {
      return this.filters().mediaType === 'tv' ? 'სერიალების სივრცე' : 'ფილმების სივრცე';
    }

    return this.filters().mediaType === 'tv' ? 'Series Library' : 'Movie Library';
  }

  heroCopy(): string {
    if (this.lang.language() === 'ka') {
      return this.filters().mediaType === 'tv'
        ? 'იპოვე სერიალები განწყობის, ჟანრის, რეიტინგისა და გამოშვების წლის მიხედვით.'
        : 'აღმოაჩინე ფილმები, რომლებიც შენს საღამოს მოუხდება. გამოიყენე ფილტრები და სწრაფად იპოვე სასურველი სათაური.';
    }

    return this.filters().mediaType === 'tv'
      ? 'Find series by mood, genre, rating and release year with a polished browsing experience.'
      : 'Discover movies for every kind of night. Tune the filters and move through the catalog with ease.';
  }

  resultTitle(): string {
    if (this.lang.language() === 'ka') {
      return this.filters().mediaType === 'tv' ? 'სერიალები შენთვის' : 'ფილმები შენთვის';
    }

    return this.filters().mediaType === 'tv' ? 'Series picked for you' : 'Movies picked for you';
  }

  resultCopy(): string {
    return this.lang.language() === 'ka'
      ? 'დააზუსტე ჟანრი, წელი ან რეიტინგი და მიიღე უფრო ზუსტი არჩევანი.'
      : 'Refine the genre, year or rating to shape the selection around your taste.';
  }

  goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages());
    if (nextPage === this.page()) {
      return;
    }

    this.page.set(nextPage);
    this.load(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private load(reset: boolean): void {
    if (reset) {
      this.page.set(1);
      this.items.set([]);
    }
    this.loading.set(true);
    const filters = this.filters();
    const firstTmdbPage = (this.page() - 1) * this.tmdbPagesPerView + 1;
    const pages = Array.from({ length: this.tmdbPagesPerView }, (_, index) => firstTmdbPage + index);
    const requests = pages.map((tmdbPage) =>
      filters.query.trim().length >= 2
        ? this.search.search(filters.query, tmdbPage)
        : filters.mediaType === 'tv'
          ? this.series.discover({ ...filters, mediaType: 'tv' }, tmdbPage)
          : this.movies.discover({ ...filters, mediaType: 'movie' }, tmdbPage),
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const mergedResults = results.flatMap((result) => result.results);
        const unique = new Map(mergedResults.map((item) => [`${item.mediaType}-${item.id}`, item]));
        const typed = filters.mediaType === 'all' ? [...unique.values()] : [...unique.values()].filter((item) => item.mediaType === filters.mediaType);
        this.items.set(typed.slice(0, this.itemsPerView));
        this.totalPages.set(Math.max(1, Math.ceil((results[0].totalPages * 20) / this.itemsPerView)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
