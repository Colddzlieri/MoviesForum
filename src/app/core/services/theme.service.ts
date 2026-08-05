import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

export type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(LocalStorageService);
  private readonly themeStore = this.storage.createSignal<ThemeMode>('ColdMovie:theme', 'dark');
  private transitionTimer: number | null = null;
  private initialized = false;

  readonly theme = this.themeStore.state;
  readonly isLight = computed(() => this.theme() === 'light');

  constructor() {
    effect(() => {
      this.applyTheme(this.theme(), this.initialized);
      this.initialized = true;
    });
  }

  toggle(): void {
    this.themeStore.set(this.isLight() ? 'dark' : 'light');
  }

  private applyTheme(theme: ThemeMode, animate: boolean): void {
    const root = this.document.documentElement;
    const body = this.document.body;

    root.dataset['theme'] = theme;
    root.style.colorScheme = theme;

    if (!animate || typeof window === 'undefined') {
      return;
    }

    body.classList.remove('theme-switching');
    void body.offsetWidth;
    body.classList.add('theme-switching');

    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
    }

    this.transitionTimer = window.setTimeout(() => {
      body.classList.remove('theme-switching');
      this.transitionTimer = null;
    }, 820);
  }
}
