import { Component, HostListener } from '@angular/core';
import { TrailerModalService } from '../../core/services/trailer-modal.service';

@Component({
  selector: 'app-trailer-modal',
  template: `
    @if (modal.current(); as trailer) {
      <div class="modal-backdrop" (click)="modal.close()" role="presentation">
        <section class="trailer-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-label]="trailer.title + ' trailer'">
          <button type="button" class="modal-close" (click)="modal.close()" aria-label="Close trailer">×</button>
          <iframe
            [src]="trailer.url"
            [title]="trailer.title + ' trailer'"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </section>
      </div>
    }
  `,
})
export class TrailerModalComponent {
  constructor(readonly modal: TrailerModalService) {}

  @HostListener('document:keydown.escape')
  close(): void {
    this.modal.close();
  }
}
