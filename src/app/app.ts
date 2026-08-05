import { AfterViewInit, Component, OnDestroy, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { TrailerModalComponent } from './components/trailer-modal/trailer-modal.component';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, TrailerModalComponent, AuthModalComponent],
  template: `
    <div class="app-loader" [class.hidden]="!showLoader()" aria-live="polite" aria-label="ColdMovie loading">
      <div class="cinema-loader" aria-hidden="true">
        <div class="loader-arrow">&#10140;</div>
      </div>
      <span>იტვირთება</span>
    </div>
    <app-header />
    <main class="app-shell">
      <router-outlet />
    </main>
    <app-footer />
    <app-trailer-modal />
    <app-auth-modal />
  `,
  styles: `
    .app-shell {
      min-height: 100dvh;
    }
  `,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  readonly showLoader = signal(true);
  private readonly routeEvents: Subscription;
  private mutationObserver: MutationObserver | null = null;
  private bootTimer: number | null = null;
  private routeTimer: number | null = null;
  private scanFrame: number | null = null;
  private gsap: typeof import('gsap').gsap | null = null;
  private scrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger | null = null;
  private loaderTimeline: { kill: () => void } | null = null;

  constructor(
    private readonly router: Router,
    readonly lang: LanguageService,
    private readonly theme: ThemeService,
  ) {
    this.routeEvents = this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationStart ||
            event instanceof NavigationEnd ||
            event instanceof NavigationCancel ||
            event instanceof NavigationError,
        ),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.showLoader.set(true);
          window.requestAnimationFrame(() => this.animateLoaderIn());
          return;
        }

        this.hideLoaderSoon(850);
        this.queueRevealScan();
      });
  }

  ngAfterViewInit(): void {
    void this.loadGsap();
  }

  ngOnDestroy(): void {
    this.routeEvents.unsubscribe();
    this.mutationObserver?.disconnect();
    this.loaderTimeline?.kill();
    this.scrollTrigger?.getAll().forEach((trigger) => trigger.kill());
    if (this.bootTimer !== null) {
      window.clearTimeout(this.bootTimer);
    }
    if (this.routeTimer !== null) {
      window.clearTimeout(this.routeTimer);
    }
    if (this.scanFrame !== null) {
      window.cancelAnimationFrame(this.scanFrame);
    }
  }

  private async loadGsap(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);
    this.gsap = gsap;
    this.scrollTrigger = ScrollTrigger;
    document.body.classList.add('gsap-ready');
    this.setupGsapAnimations();
    this.animateLoaderIn();
    this.bootTimer = window.setTimeout(() => this.animateLoaderOut(), 1500);
  }

  private setupGsapAnimations(): void {
    if (typeof window === 'undefined' || !this.gsap) {
      return;
    }

    this.scanRevealTargets();
    this.mutationObserver = new MutationObserver((mutations) => {
      const shouldScan = mutations.some((mutation) => mutation.addedNodes.length > 0);
      if (shouldScan) {
        this.queueRevealScan();
      }
    });
    this.mutationObserver.observe(document.querySelector('.app-shell') ?? document.body, { childList: true, subtree: true });
  }

  private queueRevealScan(): void {
    if (typeof window === 'undefined' || !this.gsap) {
      return;
    }

    if (this.scanFrame !== null) {
      return;
    }

    this.scanFrame = window.requestAnimationFrame(() => {
      this.scanFrame = null;
      this.scanRevealTargets();
    });
  }

  private scanRevealTargets(): void {
    if (typeof window === 'undefined' || !this.gsap) {
      return;
    }

    const gsap = this.gsap;
    const selector = [
      '.page-hero',
      '.hero-content',
      '.section-heading',
      '.movie-row',
      '.search-bar',
      '.details-hero-inner',
      '.details-meta',
      '.details-section',
      '.details-sections',
      '.cast-grid',
      '.review-card',
      '.review-form',
      '.settings-card',
      '.settings-summary',
      '.premium-genre-grid',
      '.empty-state',
      '.not-found-panel',
      '.post-composer',
      '.post-card',
      '.post-detail-card',
      '.comments-panel',
      '.admin-stats-grid',
      '.admin-post-card',
      '.fb-card',
      '.fb-post-card',
      '.fb-composer',
      '.fb-rail-card',
    ].join(',');

    document.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
      if (element.dataset['revealed'] === 'true') {
        return;
      }

      element.dataset['revealed'] = 'true';
      element.classList.add('scroll-reveal');
      element.style.setProperty('--reveal-delay', `${Math.min(index % 10, 7) * 45}ms`);
      gsap.fromTo(
        element,
        {
          autoAlpha: 0,
          y: 54,
          scale: 0.965,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          delay: Math.min(index % 10, 7) * 0.045,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 96%',
            once: true,
          },
          onComplete: () => element.classList.add('is-visible'),
        },
      );
    });

    this.animateCardGrids(gsap);

    if (document.querySelector('.scroll-reveal:not(.is-visible)')) {
      this.scrollTrigger?.refresh();
    }
  }

  private animateCardGrids(gsap: typeof import('gsap').gsap): void {
    document.querySelectorAll<HTMLElement>('.media-grid').forEach((grid) => {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.grid-card-motion:not([data-card-revealed="true"])'));
      if (!cards.length) {
        return;
      }

      cards.forEach((card) => {
        card.dataset['cardRevealed'] = 'true';
      });

      gsap.fromTo(
        cards,
        {
          autoAlpha: 0,
          y: 58,
          rotateX: 7,
          scale: 0.955,
        },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          duration: 0.42,
          ease: 'back.out(1.35)',
          stagger: {
            each: 0.026,
            from: 'start',
            grid: 'auto',
          },
          scrollTrigger: {
            trigger: grid,
            start: 'top 86%',
            once: true,
          },
        },
      );
    });
  }

  private hideLoaderSoon(delay: number): void {
    if (this.routeTimer !== null) {
      window.clearTimeout(this.routeTimer);
    }

    this.routeTimer = window.setTimeout(() => {
      this.animateLoaderOut();
      this.routeTimer = null;
    }, delay);
  }

  private animateLoaderIn(): void {
    const loader = document.querySelector<HTMLElement>('.app-loader');
    if (!loader || !this.gsap) {
      return;
    }

    this.loaderTimeline?.kill();
    this.loaderTimeline = this.gsap
      .timeline()
      .set(loader, { autoAlpha: 1, y: 0, pointerEvents: 'auto' })
      .fromTo('.cinema-loader', { y: -34, scale: 0.86, rotate: -5 }, { y: 0, scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(1.7)' }, 0)
      .fromTo('.app-loader > span', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power2.out' }, 0.18);
  }

  private animateLoaderOut(): void {
    const loader = document.querySelector<HTMLElement>('.app-loader');
    if (!loader || !this.showLoader() || !this.gsap) {
      return;
    }

    this.loaderTimeline?.kill();
    this.loaderTimeline = this.gsap
      .timeline({
        onComplete: () => this.showLoader.set(false),
      })
      .to('.cinema-loader', { y: -20, scale: 0.94, autoAlpha: 0, duration: 0.38, ease: 'power2.inOut' }, 0)
      .to('.app-loader > span', { y: -10, autoAlpha: 0, duration: 0.28, ease: 'power2.inOut' }, 0)
      .to(loader, { autoAlpha: 0, y: -26, pointerEvents: 'none', duration: 0.48, ease: 'power2.inOut' }, 0.12);
  }
}
