import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer class="site-footer social-footer">
      <div class="footer-main-row">
        <a routerLink="/" class="brand brand-logo footer-logo" aria-label="ColdMovie მთავარი">
          <img src="/coldmovie-logo.svg" alt="ColdMovie" />
        </a>

        <nav class="footer-nav" aria-label="ქვედა ნავიგაცია">
          <a routerLink="/">მთავარი</a>
          <a routerLink="/movies">ფილმები</a>
          <a routerLink="/series">სერიალები</a>
          <a routerLink="/favorites">ფავორიტები</a>
          <a routerLink="/watchlist">სანახავი</a>
          <a routerLink="/profile">პროფილი</a>
        </nav>
      </div>

      <div class="footer-bottom-row">
        <p>კინოს სოციალური ლენტი, სადაც პოსტები, კომენტარები და საყვარელი სათაურები ერთ სივრცეშია.</p>
        <span>TMDB API გამოიყენება მონაცემებისა და სურათებისთვის. პროექტი არ არის დამოწმებული TMDB-ის მიერ.</span>
        <strong>&copy; 2026 ColdMovie</strong>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
