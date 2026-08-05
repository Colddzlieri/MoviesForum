import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiscoverFilters, Genre, MediaType, SortOption } from '../../core/models/media.models';
import { LanguageService } from '../../core/services/language.service';

type MenuName = 'genre' | 'rating' | 'sort' | 'type';

@Component({
  selector: 'app-filter-panel',
  imports: [FormsModule],
  template: `
    <form class="filter-panel filter-panel-v2" (submit)="$event.preventDefault()">
      <div class="filter-topline">
        <label class="filter-control search-control">
          <span>{{ text('სათაური', 'Title') }}</span>
          <input
            [(ngModel)]="filters.query"
            name="query"
            [placeholder]="text('მოძებნე ფილმი ან სერიალი', 'Search movies or series')"
            (ngModelChange)="emit()"
          />
        </label>
        <button class="clear-filters" type="button" (click)="clear()">{{ text('გასუფთავება', 'Reset') }}</button>
      </div>

      <div class="filter-grid-v2">
        <div class="filter-control custom-select">
          <span>{{ text('ჟანრი', 'Genre') }}</span>
          <button type="button" (click)="toggleMenu('genre')">{{ selectedGenreLabel() }}</button>
          @if (openMenu() === 'genre') {
            <div class="filter-menu genre-menu">
              <button type="button" [class.active]="filters.genreId === null" (click)="setGenre(null)">{{ text('ყველა ჟანრი', 'All genres') }}</button>
              @for (genre of genres; track genre.id) {
                <button type="button" [class.active]="filters.genreId === genre.id" (click)="setGenre(genre.id)">{{ genre.name }}</button>
              }
            </div>
          }
        </div>

        <div class="filter-control custom-select">
          <span>{{ text('რეიტინგი', 'Rating') }}</span>
          <button type="button" (click)="toggleMenu('rating')">{{ selectedRatingLabel() }}</button>
          @if (openMenu() === 'rating') {
            <div class="filter-menu">
              <button type="button" [class.active]="filters.minRating === null" (click)="setRating(null)">{{ text('ნებისმიერი', 'Any rating') }}</button>
              <button type="button" [class.active]="filters.minRating === 8" (click)="setRating(8)">8+</button>
              <button type="button" [class.active]="filters.minRating === 7" (click)="setRating(7)">7+</button>
              <button type="button" [class.active]="filters.minRating === 6" (click)="setRating(6)">6+</button>
            </div>
          }
        </div>

        <div class="filter-control custom-select">
          <span>{{ text('სორტირება', 'Sort') }}</span>
          <button type="button" (click)="toggleMenu('sort')">{{ selectedSortLabel() }}</button>
          @if (openMenu() === 'sort') {
            <div class="filter-menu">
              @for (option of sortOptions; track option.value) {
                <button type="button" [class.active]="filters.sortBy === option.value" (click)="setSort(option.value)">{{ label(option.ka, option.en) }}</button>
              }
            </div>
          }
        </div>

        <div class="filter-control custom-select">
          <span>{{ text('ტიპი', 'Type') }}</span>
          <button type="button" (click)="toggleMenu('type')">{{ selectedTypeLabel() }}</button>
          @if (openMenu() === 'type') {
            <div class="filter-menu">
              <button type="button" [class.active]="filters.mediaType === 'all'" (click)="setType('all')">{{ text('ყველა', 'All') }}</button>
              <button type="button" [class.active]="filters.mediaType === 'movie'" (click)="setType('movie')">{{ lang.t('movie') }}</button>
              <button type="button" [class.active]="filters.mediaType === 'tv'" (click)="setType('tv')">{{ lang.t('tv') }}</button>
            </div>
          }
        </div>
      </div>

      <section class="year-filter-v2" [attr.aria-label]="text('წლის არჩევა', 'Year filter')">
        <div class="year-heading">
          <span>{{ text('წელი', 'Year') }}</span>
          <strong>{{ selectedYearLabel() }}</strong>
        </div>
        <div class="year-chips-v2">
          <button type="button" [class.active]="filters.releaseYear === null" (click)="setYear(null)">{{ text('ყველა', 'Any') }}</button>
          @for (year of quickYears; track year) {
            <button type="button" [class.active]="filters.releaseYear === year" (click)="setYear(year)">{{ year }}</button>
          }
          <label class="year-input-pill">
            <span>{{ text('სხვა', 'Custom') }}</span>
            <input
              type="number"
              inputmode="numeric"
              min="1900"
              [max]="currentYear"
              [ngModel]="filters.releaseYear"
              name="customYear"
              [placeholder]="currentYear.toString()"
              (ngModelChange)="setYearFromInput($event)"
            />
          </label>
        </div>
      </section>
    </form>
  `,
})
export class FilterPanelComponent {
  @Input({ required: true }) filters!: DiscoverFilters;
  @Input() genres: Genre[] = [];
  @Output() filtersChange = new EventEmitter<DiscoverFilters>();

  readonly openMenu = signal<MenuName | null>(null);
  readonly currentYear = new Date().getFullYear();
  readonly quickYears = Array.from({ length: 6 }, (_, index) => this.currentYear - index);
  readonly sortOptions: Array<{ value: SortOption; ka: string; en: string }> = [
    { value: 'popularity', ka: 'პოპულარული', en: 'Popular' },
    { value: 'rating', ka: 'რეიტინგი', en: 'Top rated' },
    { value: 'newest', ka: 'უახლესი', en: 'Newest' },
    { value: 'oldest', ka: 'ძველი', en: 'Oldest' },
    { value: 'titleAsc', ka: 'სათაური A-Z', en: 'Title A-Z' },
    { value: 'titleDesc', ka: 'სათაური Z-A', en: 'Title Z-A' },
  ];

  constructor(readonly lang: LanguageService) {}

  emit(): void {
    this.filtersChange.emit({ ...this.filters });
  }

  toggleMenu(menu: MenuName): void {
    this.openMenu.set(this.openMenu() === menu ? null : menu);
  }

  setGenre(genreId: number | null): void {
    this.filters = { ...this.filters, genreId };
    this.openMenu.set(null);
    this.emit();
  }

  setRating(minRating: number | null): void {
    this.filters = { ...this.filters, minRating };
    this.openMenu.set(null);
    this.emit();
  }

  setSort(sortBy: SortOption): void {
    this.filters = { ...this.filters, sortBy };
    this.openMenu.set(null);
    this.emit();
  }

  setType(mediaType: MediaType | 'all'): void {
    this.filters = { ...this.filters, mediaType };
    this.openMenu.set(null);
    this.emit();
  }

  setYear(year: number | null): void {
    this.filters = { ...this.filters, releaseYear: year };
    this.emit();
  }

  setYearFromInput(value: string | number | null): void {
    const year = Number(value);
    if (!value || !Number.isFinite(year)) {
      this.setYear(null);
      return;
    }

    this.setYear(Math.min(Math.max(Math.round(year), 1900), this.currentYear));
  }

  selectedGenreLabel(): string {
    return this.genres.find((genre) => genre.id === this.filters.genreId)?.name ?? this.text('ყველა ჟანრი', 'All genres');
  }

  selectedRatingLabel(): string {
    return this.filters.minRating ? `${this.filters.minRating}+` : this.text('ნებისმიერი', 'Any rating');
  }

  selectedSortLabel(): string {
    const option = this.sortOptions.find((item) => item.value === this.filters.sortBy) ?? this.sortOptions[0];
    return this.label(option.ka, option.en);
  }

  selectedTypeLabel(): string {
    if (this.filters.mediaType === 'movie') return this.lang.t('movie');
    if (this.filters.mediaType === 'tv') return this.lang.t('tv');
    return this.text('ყველა', 'All');
  }

  selectedYearLabel(): string {
    return this.filters.releaseYear?.toString() ?? this.text('ყველა წელი', 'All years');
  }

  label(ka: string, en: string): string {
    return this.lang.language() === 'ka' ? ka : en;
  }

  text(ka: string, en: string): string {
    return this.label(ka, en);
  }

  clear(): void {
    this.filters = {
      mediaType: 'all',
      query: '',
      genreId: null,
      releaseYear: null,
      minRating: null,
      sortBy: 'popularity',
    };
    this.openMenu.set(null);
    this.emit();
  }
}
