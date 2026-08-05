import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

export interface ReviewFormValue {
  rating: number;
  text: string;
}

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule, RatingStarsComponent],
  template: `
    <form class="review-form cinematic-review-form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="review-form-top">
        <div>
          <span class="settings-kicker">შენი შეფასება</span>
          <strong>დატოვე შეფასება</strong>
        </div>
        <label class="review-rating-field">
          <span>შეფასება</span>
          <app-rating-stars [interactive]="true" [rating]="form.controls.rating.value || 0" (ratingChange)="form.controls.rating.setValue($event)" />
        </label>
      </div>

      <label class="review-text-field">
        <span>კომენტარი</span>
        <textarea formControlName="text" rows="4" placeholder="დაწერე რა დაგამახსოვრდა ყველაზე მეტად"></textarea>
      </label>

      @if (submitted && form.invalid) {
        <p class="form-error">საჭიროა შეფასება და მინიმუმ 10 სიმბოლოიანი კომენტარი.</p>
      }

      <div class="review-form-actions">
        <span>{{ (form.controls.text.value || '').length }}/10</span>
        <button class="btn" type="submit">კომენტარის გამოქვეყნება</button>
      </div>
    </form>
  `,
})
export class ReviewFormComponent {
  @Output() reviewCreated = new EventEmitter<ReviewFormValue>();
  private readonly fb = inject(FormBuilder);
  submitted = false;
  readonly form = this.fb.nonNullable.group({
    rating: [0, [Validators.required, Validators.min(1)]],
    text: ['', [Validators.required, Validators.minLength(10)]],
  });
  submit(): void {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }

    this.reviewCreated.emit(this.form.getRawValue());
    this.submitted = false;
    this.form.reset({ rating: 0, text: '' });
  }
}
