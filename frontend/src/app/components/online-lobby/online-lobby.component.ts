import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import { SettingsService } from '../../services/settings.service';
import { AdsService } from '../../services/ads.service';
import { FxService } from '../../services/fx.service';
import { BackButtonService } from '../../services/back-button.service';
import { Rules } from '../../models/game.model';
import { RulesPickerComponent } from '../rules-picker/rules-picker.component';

@Component({
  selector: 'app-online-lobby',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RulesPickerComponent],
  template: `
    <main class="screen lobby" [style.padding-bottom.px]="ads.bannerHeight() + 16">
      <header class="top">
        <button class="icon-btn" (click)="home()" aria-label="Back">←</button>
        <h1 class="h-title">Play Online</h1>
        <span class="status" [class]="'st-' + socket.status()">
          <i></i>{{ statusLabel() }}
        </span>
      </header>
      @if (slowWake()) {
        <p class="note">☕ Waking up the game server — the first connection can take up to a minute.</p>
      }

      <section class="paper-card card">
        <label class="field-label" for="name">Your name</label>
        <input id="name" class="field" [(ngModel)]="name" maxlength="20" placeholder="Enter your name" autocomplete="off" />

        <div class="tabs" role="tablist">
          <button role="tab" [class.on]="tab() === 'create'" [attr.aria-selected]="tab() === 'create'" (click)="tab.set('create')">Create room</button>
          <button role="tab" [class.on]="tab() === 'join'" [attr.aria-selected]="tab() === 'join'" (click)="tab.set('join')">Join friend</button>
        </div>

        @if (tab() === 'create') {
          <app-rules-picker [(rules)]="rules" />
          <button class="btn btn-primary wide big" [disabled]="busy() || !name.trim()" (click)="create()">
            {{ busy() ? 'Creating…' : 'Create room' }}
          </button>
          <p class="hint">You'll get a 6-letter code to send your friend.</p>
        } @else {
          <label class="field-label" for="code">Room code</label>
          <input id="code" class="field code" [(ngModel)]="code" maxlength="6" placeholder="ABC123"
                 autocapitalize="characters" autocomplete="off" spellcheck="false" (keyup.enter)="join()" />
          <button class="btn btn-secondary wide big" [disabled]="busy() || !name.trim() || code.trim().length < 6" (click)="join()">
            {{ busy() ? 'Joining…' : 'Join game' }}
          </button>
        }

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </section>
    </main>
  `,
  styles: `
    .lobby { display: flex; flex-direction: column; gap: 14px; }
    .top { display: flex; align-items: center; gap: 10px; }
    .top .h-title { flex: 1; margin: 0; }
    .status { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; padding: 2px 10px; border-radius: 999px; border: 2px solid var(--ink); background: var(--card); }
    .status i { width: 9px; height: 9px; border-radius: 50%; background: #aaa; }
    .st-online i { background: #2f9e44; }
    .st-connecting i, .st-idle i { background: #f59f00; animation: blink 1s infinite; }
    .st-offline i { background: var(--red); }
    .note { margin: 0; font-size: 17px; background: #fff3bf; border: 2px dashed #e0a800; border-radius: 10px; padding: 8px 12px; }
    .card { padding: 18px; }
    .tabs { display: flex; margin: 16px 0 6px; border-bottom: 2.5px solid var(--ink); }
    .tabs button { flex: 1; font: inherit; font-size: 20px; background: none; border: 0; padding: 8px; cursor: pointer; color: var(--ink-soft); border-bottom: 4px solid transparent; margin-bottom: -2.5px; }
    .tabs button.on { color: var(--ink); border-color: var(--p1); }
    .code { font-family: var(--font-title); font-size: 28px; letter-spacing: .35em; text-transform: uppercase; text-align: center; }
    .big { margin-top: 16px; font-size: 21px; padding: 13px; }
    .hint { text-align: center; color: var(--ink-soft); margin: 8px 0 0; font-size: 16px; }
    .error { margin: 12px 0 0; padding: 8px 12px; border-radius: 10px; background: #ffe3e3; color: #9b1c1c; border: 2px solid #e03131; font-size: 17px; text-align: center; }
  `
})
export class OnlineLobbyComponent implements OnInit, OnDestroy {
  readonly tab = signal<'create' | 'join'>('create');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly slowWake = signal(false);
  readonly statusLabel = computed(() => ({
    idle: 'connecting', connecting: 'connecting', online: 'online', offline: 'offline'
  })[this.socket.status()]);

  name = '';
  code = '';
  rules: Rules;

  private wakeTimer?: ReturnType<typeof setTimeout>;
  private releaseBack: () => void;

  constructor(
    readonly socket: SocketService,
    readonly ads: AdsService,
    private sessions: SessionService,
    private settings: SettingsService,
    private fx: FxService,
    private router: Router,
    back: BackButtonService
  ) {
    this.name = settings.value().name;
    this.rules = { ...settings.value().rules };
    this.releaseBack = back.push(() => this.home());
  }

  ngOnInit(): void {
    this.ads.showBanner();
    this.socket.warmUp();
    this.wakeTimer = setTimeout(() => this.slowWake.set(this.socket.status() !== 'online'), 3000);
  }

  async create(): Promise<void> {
    await this.open({ create: true, name: this.name.trim(), rules: this.rules });
  }

  async join(): Promise<void> {
    if (this.code.trim().length < 6) return;
    await this.open({ create: false, name: this.name.trim(), roomId: this.code.trim().toUpperCase() });
  }

  home(): void {
    this.router.navigate(['/']);
  }

  private async open(request: Parameters<SessionService['openOnline']>[0]): Promise<void> {
    if (!request.name || this.busy()) return;
    this.fx.play('tap');
    this.busy.set(true);
    this.error.set('');
    this.settings.update({ name: request.name, ...(request.create ? { rules: this.rules } : {}) });
    try {
      const session = await this.sessions.openOnline(request);
      this.router.navigate(['/game', session.roomId]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not connect.');
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.wakeTimer);
    this.releaseBack();
  }
}
