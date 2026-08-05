import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  imports: [FormsModule],
  template: `
    <form class="search-bar" (submit)="submit()">
      <label class="field field-wide search-field">
        <span>ძიება</span>
        <input [(ngModel)]="value" name="search" [placeholder]="placeholder" aria-label="სათაურით ძიება" (ngModelChange)="valueChange.emit(value)" />
      </label>
      <button type="submit">ძიება</button>
    </form>
  `,
})
export class SearchBarComponent {
  @Input() value = '';
  @Input() placeholder = 'მოძებნე ფილმი ან სერიალი';
  @Output() valueChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();

  submit(): void {
    this.submitted.emit(this.value.trim());
  }
}
