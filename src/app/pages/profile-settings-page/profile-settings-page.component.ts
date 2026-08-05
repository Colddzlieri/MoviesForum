import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-profile-settings-page',
  imports: [FormsModule],
  template: `
    <section class="page-hero small profile-hero">
      <h1>{{ lang.t('settings') }}</h1>
      <p>მართე შენი ColdMovie ანგარიში, პროფილის ფოტო და უსაფრთხოების პარამეტრები.</p>
    </section>

    <section class="page-pad">
      @if (auth.currentUser(); as user) {
        <div class="settings-layout">
          <aside class="settings-summary">
            <div class="settings-avatar">
              @if (user.avatarUrl) {
                <img [src]="user.avatarUrl" [alt]="user.name" />
              } @else {
                <span>{{ initials(user.name) }}</span>
              }
            </div>
            <strong>{{ user.name }}</strong>
            <span>{{ user.email }}</span>
            <p>{{ lang.t('localProfile') }}</p>
          </aside>

          <div class="settings-stack">
            <form class="settings-card" (ngSubmit)="saveProfile()">
              <div>
                <span class="settings-kicker">{{ lang.t('account') }}</span>
                <h2>{{ lang.t('profile') }}</h2>
              </div>
              <label class="field">
                <span>{{ lang.t('name') }}</span>
                <input [(ngModel)]="name" name="name" required minlength="2" autocomplete="name" />
              </label>
              <label class="field">
                <span>{{ lang.t('email') }}</span>
                <input [(ngModel)]="email" name="email" required type="email" autocomplete="email" />
              </label>
              @if (profileMessage()) {
                <p class="settings-message" [class.error]="profileError()">{{ profileMessage() }}</p>
              }
              <button class="btn" type="submit">{{ lang.t('saveChanges') }}</button>
            </form>

            <section class="settings-card avatar-card">
              <div>
                <span class="settings-kicker">{{ lang.t('profilePhoto') }}</span>
                <h2>{{ lang.t('avatar') }}</h2>
              </div>
              <div class="avatar-editor">
                <div class="avatar-preview">
                  @if (auth.currentUser()?.avatarUrl) {
                    <img [src]="auth.currentUser()?.avatarUrl" [alt]="auth.currentUser()?.name || lang.t('profile')" />
                  } @else {
                    <span>{{ initials(name) || 'CM' }}</span>
                  }
                </div>
                <div class="avatar-actions">
                  <p>{{ lang.t('avatarHelp') }}</p>
                  <div class="avatar-buttons">
                    <label class="btn ghost file-button">
                      {{ lang.t('uploadPhoto') }}
                      <input type="file" accept="image/*" (change)="uploadAvatar($event)" />
                    </label>
                    @if (auth.currentUser()?.avatarUrl) {
                      <button class="btn quiet" type="button" (click)="removeAvatar()">{{ lang.t('removePhoto') }}</button>
                    }
                  </div>
                </div>
              </div>
              @if (avatarMessage()) {
                <p class="settings-message" [class.error]="avatarError()">{{ avatarMessage() }}</p>
              }
            </section>

            <form class="settings-card" (ngSubmit)="savePassword()">
              <div>
                <span class="settings-kicker">{{ lang.t('security') }}</span>
                <h2>{{ lang.t('password') }}</h2>
              </div>
              <label class="field">
                <span>{{ lang.t('currentPassword') }}</span>
                <input [(ngModel)]="currentPassword" name="currentPassword" type="password" autocomplete="current-password" />
              </label>
              <label class="field">
                <span>{{ lang.t('newPassword') }}</span>
                <input [(ngModel)]="newPassword" name="newPassword" type="password" minlength="4" autocomplete="new-password" />
              </label>
              @if (passwordMessage()) {
                <p class="settings-message" [class.error]="passwordError()">{{ passwordMessage() }}</p>
              }
              <button class="btn ghost" type="submit">{{ lang.t('saveChanges') }}</button>
            </form>

            <section class="settings-card danger-zone">
              <div>
                <span class="settings-kicker">{{ lang.t('security') }}</span>
                <h2>{{ lang.t('deleteAccount') }}</h2>
              </div>
              <p>{{ lang.t('deleteHelp') }}</p>
              <button class="btn quiet" type="button" (click)="deleteAccount()">{{ lang.t('deleteAccount') }}</button>
            </section>
          </div>
        </div>
      } @else {
        <section class="auth-required">
          <p>{{ lang.t('needLogin') }}</p>
          <button class="btn" type="button" (click)="auth.open('login')">{{ lang.t('login') }}</button>
        </section>
      }
    </section>
  `,
})
export class ProfileSettingsPageComponent implements OnInit {
  name = '';
  email = '';
  currentPassword = '';
  newPassword = '';
  readonly profileMessage = signal('');
  readonly profileError = signal(false);
  readonly avatarMessage = signal('');
  readonly avatarError = signal(false);
  readonly passwordMessage = signal('');
  readonly passwordError = signal(false);

  constructor(
    readonly auth: AuthService,
    readonly lang: LanguageService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.fillFromUser();
  }

  saveProfile(): void {
    this.auth.updateProfile(this.name, this.email).subscribe((error) => {
      this.profileError.set(Boolean(error));
      this.profileMessage.set(error ?? this.lang.t('profileUpdated'));
      this.fillFromUser();
    });
  }

  savePassword(): void {
    if (!this.currentPassword || this.newPassword.length < 4) {
      this.passwordError.set(true);
      this.passwordMessage.set(this.lang.t('passwordHelp'));
      return;
    }

    const error = this.auth.updatePassword(this.currentPassword, this.newPassword);
    this.passwordError.set(Boolean(error));
    this.passwordMessage.set(error ?? this.lang.t('passwordUpdated'));
    if (!error) {
      this.currentPassword = '';
      this.newPassword = '';
    }
  }

  uploadAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isSupportedImage(file)) {
      this.setAvatarMessage(this.lang.t('avatarTypeError'), true);
      input.value = '';
      return;
    }

    if (file.size > 5_000_000) {
      this.setAvatarMessage(this.lang.t('avatarSizeError'), true);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      this.auth.updateAvatar(result || null).subscribe((error) => {
        this.setAvatarMessage(error ?? this.lang.t('avatarUpdated'), Boolean(error));
        input.value = '';
      });
    };
    reader.onerror = () => {
      this.setAvatarMessage(this.lang.t('avatarReadError'), true);
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.auth.updateAvatar(null).subscribe((error) => {
      this.setAvatarMessage(error ?? this.lang.t('avatarRemoved'), Boolean(error));
    });
  }

  deleteAccount(): void {
    this.auth.deleteAccount();
    void this.router.navigate(['/']);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private fillFromUser(): void {
    const user = this.auth.currentUser();
    this.name = user?.name ?? '';
    this.email = user?.email ?? '';
  }

  private setAvatarMessage(message: string, isError: boolean): void {
    this.avatarError.set(isError);
    this.avatarMessage.set(message);
  }

  private isSupportedImage(file: File): boolean {
    return /^image\/(avif|gif|jpe?g|png|webp)$/i.test(file.type) || /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
  }
}
