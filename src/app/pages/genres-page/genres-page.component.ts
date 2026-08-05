import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { Genre } from '../../core/models/media.models';
import { GenreService } from '../../core/services/genre.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-genres-page',
  imports: [RouterLink, FormsModule, EmptyStateComponent],
  template: `
    <section class="genres-page">
      <section class="genres-hero">
        <div class="genres-hero-copy">
          <span class="settings-kicker">ColdMovie Library</span>
          <h1>{{ lang.t('genres') }}</h1>
          <p>{{ lang.t('catalogCopy') }}</p>
        </div>
        <div class="genres-stats" aria-label="Genre statistics">
          <div>
            <strong>{{ genres().length }}</strong>
            <span>{{ lang.t('genres') }}</span>
          </div>
          <div>
            <strong>TMDB</strong>
            <span>{{ lang.language() === 'ka' ? 'ცოცხალი მონაცემები' : 'Live data' }}</span>
          </div>
        </div>
      </section>

      <section class="genres-toolbar">
        <label class="genre-search">
          <span>{{ lang.t('search') }}</span>
          <input [ngModel]="query()" (ngModelChange)="query.set($event)" name="genreQuery" [placeholder]="lang.language() === 'ka' ? 'მოძებნე ჟანრი' : 'Search genres'" />
        </label>
        <p>{{ filteredGenres().length }} / {{ genres().length }}</p>
      </section>

      <section class="page-pad genres-pad">
        @if (filteredGenres().length) {
          <div class="genre-grid premium-genre-grid">
            @for (genre of filteredGenres(); track genre.id; let index = $index) {
              <a class="genre-card" [style.--genre-index]="index" [routerLink]="['/genre', genre.id]">
                <span class="genre-number">{{ (index + 1).toString().padStart(2, '0') }}</span>
                <strong>{{ genre.name }}</strong>
                <small>{{ genreSubtitle(index) }}</small>
              </a>
            }
          </div>
        } @else {
          <app-empty-state
            [title]="lang.language() === 'ka' ? 'ჟანრი ვერ მოიძებნა' : 'No genres found'"
            [message]="lang.language() === 'ka' ? 'სხვა საძიებო სიტყვა სცადე.' : 'Try a different search term.'"
          />
        }
      </section>
    </section>
  `,
})
export class GenresPageComponent implements OnInit, OnDestroy {
  readonly genres = signal<Genre[]>([]);
  readonly query = signal('');
  readonly filteredGenres = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return this.genres();
    }

    return this.genres().filter((genre) => genre.name.toLowerCase().includes(term));
  });
  private subscription: Subscription | null = null;

  constructor(
    private readonly genreService: GenreService,
    readonly lang: LanguageService,
  ) {}

  ngOnInit(): void {
    this.subscription = this.genreService.genres$.subscribe({
      next: (genres) => this.genres.set(genres),
      error: () => this.genres.set([]),
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  genreSubtitle(index: number): string {
    const ka = ['პოპულარული არჩევანი', 'ფილმები და სერიალები', 'კოლექციის დათვალიერება', 'ახალი აღმოჩენები'];
    const en = ['Popular picks', 'Movies and series', 'Explore collection', 'Fresh discoveries'];
    const source = this.lang.language() === 'ka' ? ka : en;
    return source[index % source.length];
  }
}
