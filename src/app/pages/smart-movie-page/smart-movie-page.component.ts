import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { MovieCardComponent } from '../../components/movie-card/movie-card.component';
import { MediaItem } from '../../core/models/media.models';
import { LanguageService } from '../../core/services/language.service';
import { SmartMovieService } from '../../core/services/smart-movie.service';

@Component({
  selector: 'app-smart-movie-page',
  imports: [FormsModule, MovieCardComponent, LoadingSkeletonComponent, EmptyStateComponent],
  template: `
    <section class="smart-hero">
      <div class="smart-hero-copy">
        <span class="settings-kicker">{{ text('რეკომენდაცია', 'Recommend') }}</span>
        <h1>{{ text('მიიღე ფილმის რეკომენდაცია ტექსტიდან', 'Get Movie Recommendations from Text') }}</h1>
        <p>
          {{
            text(
              'ჩაწერე რა ჟანრი, განწყობა ან ისტორია გინდა და ColdMovie რეალური TMDB კატალოგიდან შეგირჩევს ფილმებსა და სერიალებს.',
              'Write a genre, mood or story you want and ColdMovie will recommend movies and series from the live TMDB catalog.'
            )
          }}
        </p>
      </div>
    </section>

    <section class="page-pad smart-pad">
      <form class="smart-search-panel" (submit)="submit(); $event.preventDefault()">
        <label>
          <span>{{ text('რა გინდა ნახო?', 'What do you want to watch?') }}</span>
          <textarea
            [(ngModel)]="prompt"
            name="prompt"
            rows="6"
            [placeholder]="text('მაგ: მინდა დაძაბული sci-fi, ძლიერი ვიზუალით და საიდუმლოებით...', 'Example: I want a tense sci-fi with strong visuals and mystery...')"
          ></textarea>
        </label>
        <div class="smart-actions">
          <button class="btn" type="submit">{{ text('რეკომენდაციების მიღება', 'Get recommendations') }}</button>
          <button class="btn ghost" type="button" (click)="useExample()">{{ text('მაგალითი', 'Example') }}</button>
        </div>
      </form>

      @if (chips().length) {
        <div class="smart-chip-row" aria-label="Detected taste tags">
          @for (chip of chips(); track chip) {
            <span>{{ chip }}</span>
          }
        </div>
      }

      @if (loading()) {
        <app-loading-skeleton [count]="12" />
      } @else if (items().length) {
        <div class="catalog-results-bar smart-results-bar">
          <div>
            <span class="settings-kicker">{{ text('შედეგები', 'Results') }}</span>
            <strong>{{ text('შენზე მორგებული რეკომენდაციები', 'Recommendations for you') }}</strong>
          </div>
          <p>{{ summary() }}</p>
        </div>
        <div class="media-grid catalog-grid">
          @for (item of items(); track item.mediaType + '-' + item.id; let index = $index) {
            <app-movie-card class="grid-card-motion" [style.--card-order]="index" [item]="item" />
          }
        </div>
      } @else {
        <app-empty-state
          [title]="text('ჩაწერე ტექსტი', 'Write a prompt')"
          [message]="text('ჩაწერე ჟანრი, განწყობა ან ისტორია და მიიღე რეკომენდაციები.', 'Write a genre, mood or story and get recommendations.')"
        />
      }
    </section>
  `,
})
export class SmartMoviePageComponent {
  readonly items = signal<MediaItem[]>([]);
  readonly chips = signal<string[]>([]);
  readonly summary = signal('');
  readonly loading = signal(false);
  prompt = '';

  constructor(
    private readonly smart: SmartMovieService,
    readonly lang: LanguageService,
  ) {}

  submit(): void {
    const value = this.prompt.trim();
    if (value.length < 4) {
      this.items.set([]);
      this.chips.set([]);
      this.summary.set('');
      return;
    }

    this.loading.set(true);
    this.smart.recommendFromText(value).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.chips.set(result.chips);
        this.summary.set(result.summary);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.summary.set(this.text('კატალოგი დროებით მიუწვდომელია. სცადე თავიდან.', 'The catalog is temporarily unavailable. Try again.'));
        this.loading.set(false);
      },
    });
  }

  useExample(): void {
    this.prompt = this.text(
      'მინდა თანამედროვე, მაღალი რეიტინგის მქონე დაძაბული sci-fi ან thriller, ბევრი საიდუმლოებით და კარგი ვიზუალით.',
      'I want a modern high rated sci-fi or thriller with suspense, mystery and strong visuals.',
    );
    this.submit();
  }

  text(ka: string, en: string): string {
    return this.lang.language() === 'ka' ? ka : en;
  }
}
