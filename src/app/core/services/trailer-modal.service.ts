import { Injectable, signal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

export interface TrailerState {
  title: string;
  url: SafeResourceUrl;
}

@Injectable({ providedIn: 'root' })
export class TrailerModalService {
  private readonly currentState = signal<TrailerState | null>(null);
  readonly current = this.currentState.asReadonly();

  open(title: string, url: SafeResourceUrl | null): void {
    if (!url) {
      return;
    }

    this.currentState.set({ title, url });
    document.body.classList.add('modal-open');
  }

  close(): void {
    this.currentState.set(null);
    document.body.classList.remove('modal-open');
  }
}
