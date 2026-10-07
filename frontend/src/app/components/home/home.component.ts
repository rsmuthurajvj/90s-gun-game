import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { SessionService } from '../../services/session.service';
import { AdsService } from '../../services/ads.service';
import { FxService } from '../../services/fx.service';
import { BackButtonService } from '../../services/back-button.service';
import { savedOnlineSeat, OnlineSeat } from '../../services/session';
import { Rules, Soldier } from '../../models/game.model';
import { SoldierComponent } from '../soldier/soldier.component';
import { HowToPlayComponent } from '../how-to-play/how-to-play.component';
import { RulesPickerComponent } from '../rules-picker/rules-picker.component';
import { environment } from '../../../environments/environment';

type Sheet = null | 'local' | 'cpu' | 'settings' | 'help';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SoldierComponent, HowToPlayComponent, RulesPickerComponent],
  template: `
    <main class="screen home" [style.padding-bottom.px]="ads.bannerHeight() + 16">
      <header class="hero">
        <div class="duel" aria-hidden="true">
          <app-soldier class="hero-soldier" [soldier]="heroSoldier" color="var(--p1)" facing="right" />
          <svg class="bullet-path" viewBox="0 0 100 20"><path d="M2 10 Q50 2 98 10" /></svg>
          <app-soldier class="hero-soldier" [soldier]="heroSoldier" color="var(--p2)" facing="left" />
        </div>
        <h1 class="logo">90s <span>Gun</span> Game</h1>
        <p class="tagline">The last-bench notebook battle — now on your phone</p>
      </header>

      @if (resumeSeat()) {
        <button class="resume paper-card" (click)="resumeOnline()">
          <span>⚡ Online game <b>{{ resumeSeat()!.roomId }}</b> in progress</span>
          <span class="btn btn-small btn-primary">Resume</span>
        </button>
      }

      <nav class="modes">
        <button class="mode-card p1" (click)="open('local')">
          <span class="mode-icon">👫</span>
          <span class="mode-text"><b>Pass &amp; Play</b><small>2 players · 1 phone · no internet</small></span>
        </button>
        <button class="mode-card p2" (click)="open('cpu')">
          <span class="mode-icon">🤖</span>
          <span class="mode-text"><b>vs Computer</b><small>practice offline</small></span>
        </button>
        <button class="mode-card online" (click)="goOnline()">
          <span class="mode-icon">🌐</span>
          <span class="mode-text"><b>Play Online</b><small>with a friend anywhere</small></span>
        </button>
      </nav>

      <div class="sub-actions">
        <button class="btn btn-ghost" (click)="open('help')">📖 How to play</button>
        <button class="btn btn-ghost" (click)="open('settings')">⚙️ Settings</button>
      </div>

      @if (record()) { <p class="record">vs Computer: <b>{{ record() }}</b></p> }
    </main>

    @if (sheet() === 'local' || sheet() === 'cpu') {
      <div class="overlay-backdrop sheet-host" (click)="close()">
        <form class="sheet paper-card" (click)="$event.stopPropagation()" (ngSubmit)="start()">
          <button type="button" class="icon-btn close" (click)="close()" aria-label="Close">✕</button>
          <h2 class="h-title">{{ sheet() === 'local' ? 'Pass & Play' : 'vs Computer' }}</h2>

          <label class="field-label" for="p1">{{ sheet() === 'local' ? 'Player 1 (blue pen)' : 'Your name' }}</label>
          <input id="p1" class="field" name="p1" [(ngModel)]="name" maxlength="20" placeholder="Enter name" autocomplete="off" />

          @if (sheet() === 'local') {
            <label class="field-label" for="p2">Player 2 (orange pen)</label>
            <input id="p2" class="field" name="p2" [(ngModel)]="friend" maxlength="20" placeholder="Friend's name" autocomplete="off" />
          } @else {
            <div class="field-label">Computer</div>
            <div class="seg">
              <button type="button" [class.on]="cpuEasy()" (click)="cpuEasy.set(true)">Easy<small>picks targets randomly</small></button>
              <button type="button" [class.on]="!cpuEasy()" (click)="cpuEasy.set(false)">Smart<small>shoots the biggest threat</small></button>
            </div>
          }

          <details class="rules-box">
            <summary>House rules</summary>
            <app-rules-picker [(rules)]="rules" />
          </details>

          <button type="submit" class="btn btn-primary wide big">Start game ▶</button>
        </form>
      </div>
    }

    @if (sheet() === 'settings') {
      <div class="overlay-backdrop sheet-host" (click)="close()">
        <div class="sheet paper-card" (click)="$event.stopPropagation()">
          <button class="icon-btn close" (click)="close()" aria-label="Close">✕</button>
          <h2 class="h-title">Settings</h2>
          <label class="toggle"><span>🔊 Sound effects</span>
            <input type="checkbox" [checked]="settings.value().sound" (change)="toggle('sound')" /></label>
          <label class="toggle"><span>📳 Vibration</span>
            <input type="checkbox" [checked]="settings.value().vibration" (change)="toggle('vibration')" /></label>
          <div class="links">
            @if (ads.privacyOptionsRequired()) {
              <button class="btn btn-ghost" (click)="ads.showPrivacyOptions()">Ad privacy choices</button>
            }
            <a class="btn btn-ghost" [href]="privacyUrl" target="_blank" rel="noopener">Privacy policy</a>
          </div>
          <p class="version">90s Gun Game · made with nostalgia in Tamil Nadu</p>
        </div>
      </div>
    }

    @if (sheet() === 'help') { <app-how-to-play (close)="close()" /> }
  `,
  styles: `
    .home { display: flex; flex-direction: column; gap: 18px; justify-content: center; }
    .hero { text-align: center; }
    .duel { display: flex; align-items: center; justify-content: center; gap: 0; height: 92px; }
    .hero-soldier { width: 84px; height: 92px; }
    .bullet-path { width: 90px; height: 20px; margin-top: -26px; overflow: visible; }
    .bullet-path path { fill: none; stroke: var(--red); stroke-width: 2.5; stroke-dasharray: 5 6; stroke-linecap: round; animation: dash-move 1s linear infinite; }
    @keyframes dash-move { to { stroke-dashoffset: -22; } }
    .logo { font-family: var(--font-title); font-size: clamp(40px, 12vw, 56px); line-height: 1; margin: 6px 0 4px; transform: rotate(-2deg); }
    .logo span { color: var(--red); text-decoration: underline wavy var(--red) 3px; text-underline-offset: 6px; }
    .tagline { margin: 6px 0 0; font-size: 19px; color: var(--ink-soft); }
    .resume { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; font: inherit; font-size: 18px; cursor: pointer; color: inherit; text-align: left; }
    .modes { display: flex; flex-direction: column; gap: 12px; }
    .mode-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-align: left; font: inherit; color: var(--ink); cursor: pointer;
                 background: var(--card); border: 2.5px solid var(--ink); border-radius: var(--wobbly); box-shadow: 4px 4px 0 var(--ink); transition: transform .1s, box-shadow .1s; }
    .mode-card:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--ink); }
    .mode-card.p1 { background: var(--p1-soft); }
    .mode-card.p2 { background: var(--p2-soft); }
    .mode-card.online { background: #e8f7ea; }
    .mode-icon { font-size: 34px; width: 48px; text-align: center; }
    .mode-text { display: flex; flex-direction: column; }
    .mode-text b { font-family: var(--font-title); font-size: 24px; font-weight: 400; }
    .mode-text small { font-size: 17px; color: var(--ink-soft); }
    .sub-actions { display: flex; gap: 10px; justify-content: center; }
    .record { text-align: center; margin: 0; color: var(--ink-soft); font-size: 18px; }
    .close { position: absolute; top: 10px; right: 10px; }
    .rules-box { margin-top: 14px; border: 2px dashed var(--ink-ghost); border-radius: 12px; padding: 8px 12px; }
    .rules-box summary { cursor: pointer; font-size: 19px; }
    .big { margin-top: 16px; font-size: 22px; padding: 14px; }
    .toggle { display: flex; align-items: center; justify-content: space-between; font-size: 20px; padding: 10px 0; border-bottom: 1px dashed var(--ink-ghost); }
    .toggle input { width: 22px; height: 22px; accent-color: var(--p1); }
    .links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .version { color: var(--ink-soft); font-size: 15px; text-align: center; margin: 16px 0 0; }
  `
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly sheet = signal<Sheet>(null);
  readonly cpuEasy = signal(false);
  readonly resumeSeat = signal<OnlineSeat | null>(savedOnlineSeat());
  readonly heroSoldier: Soldier = { stage: 11, bullets: 6, alive: true };
  readonly privacyUrl = environment.privacyPolicyUrl;

  name = '';
  friend = '';
  rules: Rules;

  readonly record = computed(() => {
    const s = this.settings.value().stats;
    return s.cpuWins + s.cpuLosses ? `${s.cpuWins} won · ${s.cpuLosses} lost` : '';
  });

  private releaseBack: (() => void) | null = null;

  constructor(
    readonly settings: SettingsService,
    readonly ads: AdsService,
    private sessions: SessionService,
    private fx: FxService,
    private back: BackButtonService,
    private router: Router
  ) {
    const s = settings.value();
    this.name = s.name;
    this.friend = s.friendName;
    this.rules = { ...s.rules };
    this.cpuEasy.set(s.cpuEasy);
  }

  ngOnInit(): void {
    this.ads.showBanner();
    // First launch: teach the rules once.
    if (!this.settings.value().seenTutorial) {
      this.open('help');
      this.settings.update({ seenTutorial: true });
    }
  }

  open(sheet: Sheet): void {
    this.fx.play('tap');
    this.sheet.set(sheet);
    this.releaseBack?.();
    this.releaseBack = this.back.push(() => this.close());
  }

  close(): void {
    this.sheet.set(null);
    this.releaseBack?.();
    this.releaseBack = null;
  }

  toggle(key: 'sound' | 'vibration'): void {
    this.settings.update({ [key]: !this.settings.value()[key] });
    this.fx.play('tap');
  }

  start(): void {
    const mode = this.sheet();
    const name = this.name.trim() || 'Player 1';
    const friend = this.friend.trim() || 'Player 2';
    this.settings.update({ name: this.name.trim(), friendName: this.friend.trim(), rules: this.rules, cpuEasy: this.cpuEasy() });
    if (mode === 'local') this.sessions.startLocal([name, friend], this.rules);
    else this.sessions.startCpu(name, this.rules, this.cpuEasy());
    this.close();
    this.fx.play('tap');
    this.router.navigate(['/play']);
  }

  goOnline(): void {
    this.fx.play('tap');
    this.router.navigate(['/online']);
  }

  resumeOnline(): void {
    const seat = this.resumeSeat();
    if (!seat) return;
    this.sessions.resumeOnline(seat);
    this.router.navigate(['/game', seat.roomId]);
  }

  ngOnDestroy(): void {
    this.releaseBack?.();
  }
}
