import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MediaItem } from '../../core/models/media.models';
import { MovieCardComponent } from '../movie-card/movie-card.component';

@Component({
  selector: 'app-movie-slider',
  imports: [MovieCardComponent],
  template: `
    <section class="movie-row">
      <div class="section-heading">
        <h2>{{ title }}</h2>
        <div class="slider-actions">
          <button type="button" (click)="scroll(-1)" aria-label="Scroll left">&lsaquo;</button>
          <button type="button" (click)="scroll(1)" aria-label="Scroll right">&rsaquo;</button>
        </div>
      </div>
      <div class="slider-track" #track>
        @for (item of items; track item.mediaType + '-' + item.id) {
          <app-movie-card [item]="item" />
        }
      </div>
    </section>
  `,
})
export class MovieSliderComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) items: MediaItem[] = [];
  @ViewChild('track') private readonly track?: ElementRef<HTMLDivElement>;

  scroll(direction: number): void {
    this.track?.nativeElement.scrollBy({ left: direction * 860, behavior: 'smooth' });
  }
}
