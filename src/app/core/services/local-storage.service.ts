import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  private readonly available = typeof localStorage !== 'undefined';

  read<T>(key: string, fallback: T): T {
    if (!this.available) {
      return fallback;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    if (this.available) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  createSignal<T>(key: string, fallback: T) {
    const state = signal<T>(this.read(key, fallback));
    return {
      state: state.asReadonly(),
      set: (value: T) => {
        state.set(value);
        this.write(key, value);
      },
      update: (updater: (value: T) => T) => {
        const next = updater(state());
        state.set(next);
        this.write(key, next);
      },
    };
  }
}
