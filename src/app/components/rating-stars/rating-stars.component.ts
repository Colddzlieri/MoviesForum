import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  template: `
    <div class="stars" [class.interactive]="interactive" [attr.aria-label]="rating + ' out of ' + max + ' stars'">
      @for (star of stars; track star) {
        <button
          type="button"
          [disabled]="!interactive"
          [class.active]="star <= rating"
          (click)="select(star)"
          [attr.aria-label]="'Rate ' + star + ' stars'"
        >
          ★
        </button>
      }
    </div>
  `,
})
export class RatingStarsComponent {
  @Input() rating = 0;
  @Input() max = 5;
  @Input() interactive = false;
  @Output() ratingChange = new EventEmitter<number>();

  get stars(): number[] {
    return Array.from({ length: this.max }, (_, index) => index + 1);
  }

  select(value: number): void {
    if (this.interactive) {
      this.rating = value;
      this.ratingChange.emit(value);
    }
  }
}
