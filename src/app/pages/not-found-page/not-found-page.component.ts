import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <section class="page-pad not-found">
      <div class="not-found-panel">
        <span class="settings-kicker">ColdMovie</span>
        <h1>404</h1>
        <p>ეს გვერდი ColdMovie-ში არ არსებობს.</p>
        <div class="not-found-actions">
          <a class="btn" routerLink="/">მთავარზე დაბრუნება</a>
          <a class="btn ghost" routerLink="/movies">ფილმები</a>
        </div>
      </div>
    </section>
  `,
})
export class NotFoundPageComponent {}
