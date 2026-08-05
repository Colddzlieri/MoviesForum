import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <section class="empty-state">
      <div class="empty-icon" aria-hidden="true">{{ icon }}</div>
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
    </section>
  `,
})
export class EmptyStateComponent {
  @Input() icon = '⌕';
  @Input() title = 'აქ ჯერ არაფერია';
  @Input() message = 'სცადე სხვა ძიება ან შეცვალე ფილტრები.';
}
