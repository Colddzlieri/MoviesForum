import { Component, Input } from '@angular/core';
import { CastMember } from '../../core/models/media.models';

@Component({
  selector: 'app-cast-card',
  template: `
    <article class="cast-card">
      <img [src]="member.imageUrl" [alt]="member.name" loading="lazy" />
      <strong>{{ member.name }}</strong>
      <span>{{ member.character || 'Cast' }}</span>
    </article>
  `,
})
export class CastCardComponent {
  @Input({ required: true }) member!: CastMember;
}
