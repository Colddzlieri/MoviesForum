import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  template: `
    <div class="skeleton-grid" [style.--skeleton-count]="count">
      @for (item of placeholders; track item) {
        <div class="skeleton-card">
          <span></span>
          <strong></strong>
          <small></small>
        </div>
      }
    </div>
  `,
})
export class LoadingSkeletonComponent {
  @Input() count = 10;

  get placeholders(): number[] {
    return Array.from({ length: this.count }, (_, index) => index);
  }
}
