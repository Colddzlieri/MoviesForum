import { Component, HostListener, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-auth-modal',
  imports: [FormsModule],
  template: `
    @if (auth.modalMode(); as mode) {
      <div class="modal-backdrop auth-backdrop" (click)="auth.close()" role="presentation">
        <section class="auth-modal auth-modal-pro" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
          <button type="button" class="modal-close" (click)="auth.close()" aria-label="დახურვა">&times;</button>

          <div class="auth-visual">
            <div class="auth-mark" aria-hidden="true">CM</div>
            <div>
              <span class="settings-kicker">ColdMovie</span>
              <h2>{{ title() }}</h2>
              <p>{{ mode === 'register' ? 'შექმენი შენი პირადი კინო სივრცე.' : 'გააგრძელე შენახულ კინო სამყაროში.' }}</p>
            </div>
          </div>

          <div class="auth-tabs" role="tablist">
            <button type="button" [class.active]="mode === 'login'" (click)="switchMode('register')">{{ lang.t('login') }}</button>
            <button type="button" [class.active]="mode === 'register'" (click)="switchMode('login')">{{ lang.t('register') }}</button>
          </div>

          <form (ngSubmit)="submit(mode)" class="auth-form">
            @if (mode === 'register') {
              <label class="field">
                <span>{{ lang.t('name') }}</span>
                <input [(ngModel)]="name" name="name" required minlength="2" autocomplete="name" placeholder="სახელი გვარი" />
              </label>

              <div class="register-avatar-picker">
                <div class="register-avatar-preview">
                  @if (avatarUrl()) {
                    <img [src]="avatarUrl()" [alt]="name || lang.t('profile')" />
                  } @else {
                    <span>{{ initials(name) }}</span>
                  }
                </div>
                <div class="register-avatar-actions">
                  <span class="settings-kicker">{{ lang.t('profilePhoto') }}</span>
                  <label class="btn ghost file-button">
                    {{ lang.t('uploadPhoto') }}
                    <input type="file" accept="image/*" (change)="uploadAvatar($event)" />
                  </label>
                  @if (avatarUrl()) {
                    <button class="btn quiet" type="button" (click)="removeAvatar()">{{ lang.t('removePhoto') }}</button>
                  }
                </div>
              </div>
            }

            <label class="field">
              <span>{{ lang.t('email') }}</span>
              <input [(ngModel)]="email" name="email" required type="text" autocomplete="username" placeholder="you@example.com / Cold" />
            </label>

            <label class="field password-field">
              <span>{{ lang.t('password') }}</span>
              <input
                [(ngModel)]="password"
                name="password"
                required
                [type]="showPassword() ? 'text' : 'password'"
                [attr.minlength]="mode === 'register' ? 6 : 1"
                autocomplete="current-password"
                placeholder="••••••••"
              />
              <button type="button" (click)="showPassword.update((value) => !value)" aria-label="პაროლის ჩვენება ან დამალვა">
                {{ showPassword() ? 'დამალვა' : 'ჩვენება' }}
              </button>
            </label>

            @if (mode === 'register') {
              <label class="field password-field">
                <span>{{ lang.t('newPassword') }}</span>
                <input
                  [(ngModel)]="confirmPassword"
                  name="confirmPassword"
                  required
                  [type]="showPassword() ? 'text' : 'password'"
                  minlength="6"
                  autocomplete="new-password"
                  placeholder="გაიმეორე პაროლი"
                />
              </label>

              <label class="terms-check">
                <input [(ngModel)]="acceptedTerms" name="acceptedTerms" type="checkbox" />
                <span>ვეთანხმები ColdMovie ანგარიშის შექმნას.</span>
              </label>
            }

            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }

            <button class="btn auth-submit" type="submit">{{ title() }}</button>
          </form>
        </section>
      </div>
    }
  `,
})
export class AuthModalComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptedTerms = false;
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly avatarUrl = signal('');
  readonly title = computed(() => (this.auth.modalMode() === 'register' ? this.lang.t('register') : this.lang.t('login')));

  constructor(
    readonly auth: AuthService,
    readonly lang: LanguageService,
  ) {}

  submit(mode: 'login' | 'register'): void {
    this.error.set('');

    if (mode === 'register') {
      const validation = this.validateRegistration();
      if (validation) {
        this.error.set(validation);
        return;
      }
    }

    const request = mode === 'register'
      ? this.auth.register(this.name, this.email, this.password, this.avatarUrl() || undefined)
      : this.auth.login(this.email, this.password);

    request.subscribe((error) => {
      if (error) {
        this.error.set(error);
      }
    });
  }

  switchMode(currentMode: 'login' | 'register'): void {
    this.error.set('');
    this.auth.open(currentMode === 'login' ? 'register' : 'login');
  }

  uploadAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isSupportedImage(file)) {
      this.error.set(this.lang.t('avatarTypeError'));
      input.value = '';
      return;
    }

    if (file.size > 5_000_000) {
      this.error.set(this.lang.t('avatarSizeError'));
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.avatarUrl.set(typeof reader.result === 'string' ? reader.result : '');
      this.error.set('');
      input.value = '';
    };
    reader.onerror = () => {
      this.error.set(this.lang.t('avatarReadError'));
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatarUrl.set('');
  }

  initials(name: string): string {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'CM'
    );
  }

  private isSupportedImage(file: File): boolean {
    return file.type.startsWith('image/') || /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i.test(file.name);
  }

  private validateRegistration(): string | null {
    if (this.password !== this.confirmPassword) {
      return 'პაროლები ერთმანეთს არ ემთხვევა.';
    }

    if (!this.acceptedTerms) {
      return 'ანგარიშის შესაქმნელად მონიშნე თანხმობა.';
    }

    return null;
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.auth.close();
  }
}
