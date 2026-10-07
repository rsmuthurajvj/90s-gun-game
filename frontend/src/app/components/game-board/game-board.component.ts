import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, firstValueFrom, race, timer } from 'rxjs';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  GameState, Player, RollAction, SLOT_NUMBERS, SOLDIER_SLOTS, SlotKey, Soldier, describeRoll
} from '../../models/game.model';
import { GameSession, OnlineSession, SessionEvent, savedOnlineSeat } from '../../services/session';
import { SessionService } from '../../services/session.service';
import { SettingsService } from '../../services/settings.service';
import { FxService } from '../../services/fx.service';
import { AdsService } from '../../services/ads.service';
import { BackButtonService } from '../../services/back-button.service';
import { SoldierComponent } from '../soldier/soldier.component';
import { BookOverlayComponent, RollView } from '../book-overlay/book-overlay.component';
import { CoinTossComponent, CoinView } from '../coin-toss/coin-toss.component';
import { HowToPlayComponent } from '../how-to-play/how-to-play.component';
import { environment } from '../../../environments/environment';

interface ShotFx {
  w: number; h: number;
  x1: number; y1: number; x2: number; y2: number;
  hit: boolean;
}

type Tone = 'normal' | 'alert' | 'warn' | 'muted';

const EMPTY_SOLDIER: Soldier = { stage: 0, bullets: 0, alive: true };
const ROLL_TONE: Record<RollAction, RollView['tone']> = {
  GROW: 'good', LOAD: 'good', LOADED: 'good', RELOAD: 'good', SHOOT: 'shoot', DEAD: 'bad'
};

@Component({
  selector: 'app-game-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SoldierComponent, BookOverlayComponent, CoinTossComponent, HowToPlayComponent],
  templateUrl: './game-board.component.html',
  styleUrl: './game-board.component.css'
})
export class GameBoardComponent implements OnInit, OnDestroy {
  @ViewChild('board') private boardEl?: ElementRef<HTMLElement>;

  session!: GameSession;
  readonly slots = SOLDIER_SLOTS;
  readonly slotNumbers = SLOT_NUMBERS;
  readonly confetti = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 7) * 0.18, color: ['#1f4fd1', '#d9480f', '#e9b949', '#2f9e44', '#d62828'][i % 5]
  }));

  /** What the board shows — lags behind the session while animations play. */
  readonly view = signal<GameState | null>(null);
  readonly busy = signal(false);
  /** Waiting for the server/session to answer our last action. */
  readonly awaiting = signal(false);
  readonly rollView = signal<RollView | null>(null);
  readonly coinAnim = signal<CoinView | null>(null);
  readonly rolledCell = signal<string | null>(null);
  readonly flashCell = signal<string | null>(null);
  readonly shotFx = signal<ShotFx | null>(null);
  readonly shake = signal(false);
  readonly toast = signal('');
  readonly sheet = signal<null | 'log' | 'help' | 'leave'>(null);
  readonly resultOpen = signal(false);
  readonly rematchAsked = signal(false);

  readonly mode = computed(() => this.session?.mode);
  readonly status = computed(() => this.view()?.status);
  readonly isOnline = computed(() => this.session?.mode === 'online');

  readonly canRoll = computed(() => {
    const v = this.view();
    return !!v && !this.busy() && !this.awaiting() && v.status === 'playing' && this.session.controls(v.currentTurn);
  });

  readonly choosing = computed(() => {
    const v = this.view();
    return !!v && !this.busy() && !this.awaiting() && v.status === 'choosing_target' && this.session.controls(v.currentTurn);
  });

  readonly coinView = computed<CoinView | null>(() => {
    const anim = this.coinAnim();
    if (anim) return anim;
    const v = this.view();
    if (v?.status !== 'coin_toss') return null;
    const caller = v.players[0]?.name ?? 'Player 1';
    return { phase: this.session.controls(0) && !this.awaiting() ? 'choose' : 'waiting', callerName: caller };
  });

  readonly statusLine = computed<{ text: string; tone: Tone }>(() => {
    const v = this.view();
    if (!v) return { text: 'Connecting to the game…', tone: 'muted' };
    const cur = v.players[v.currentTurn]?.name ?? '';
    const opp = this.opponentIndex();
    const oppPlayer = opp === null ? null : v.players[opp];

    if (v.status === 'finished') return { text: `${v.players[v.winner]?.name} won round ${v.round}!`, tone: 'normal' };
    if (v.status !== 'playing' && v.status !== 'choosing_target') return { text: '', tone: 'muted' };
    if (this.isOnline() && oppPlayer && oppPlayer.connected === false) {
      return { text: `${oppPlayer.name} is offline — waiting for them to come back…`, tone: 'warn' };
    }
    const mine = this.session.controls(v.currentTurn);
    if (v.status === 'choosing_target') {
      return mine
        ? { text: '🎯 Tap an enemy soldier to shoot!', tone: 'alert' }
        : { text: `${cur} is taking aim…`, tone: 'warn' };
    }
    if (mine) return { text: this.session.me === -1 ? `${cur}'s turn — open the book!` : 'Your turn — open the book!', tone: 'normal' };
    return { text: this.session.mode === 'cpu' ? 'Computer is opening the book…' : `${cur}'s turn…`, tone: 'muted' };
  });

  readonly result = computed(() => {
    const v = this.view();
    if (v?.status !== 'finished') return null;
    const me = this.session.me;
    const winner = v.players[v.winner];
    const iWon = me === -1 ? null : v.winner === me;
    const opp = this.opponentIndex();
    return {
      iWon,
      title: iWon === null ? `${winner?.name} wins!` : iWon ? 'You win!' : 'You lose!',
      icon: iWon === false ? '💀' : '🏆',
      myVote: me >= 0 && !!v.rematchVotes?.[me],
      oppVote: opp !== null && !!v.rematchVotes?.[opp],
      oppName: opp !== null ? v.players[opp]?.name : '',
      oppGone: this.isOnline() && opp !== null && v.players[opp]?.connected === false
    };
  });

  private queue: SessionEvent[] = [];
  private pumping = false;
  private readonly skip$ = new Subject<void>();
  private sub?: Subscription;
  private releaseBack?: () => void;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sessions: SessionService,
    private settings: SettingsService,
    readonly fx: FxService,
    private ads: AdsService,
    private back: BackButtonService
  ) {}

  ngOnInit(): void {
    this.ads.hideBanner();
    const session = this.resolveSession();
    if (!session) {
      this.router.navigate(['/']);
      return;
    }
    this.session = session;
    this.sub = session.events$.subscribe((ev) => {
      this.awaiting.set(false);
      this.enqueue(ev);
    });
    if (session.state) this.enqueue({ kind: 'sync', state: session.state });
    this.releaseBack = this.back.push(() => this.onBack());
  }

  /** The running session, or reconnect to a saved online seat after a reload. */
  private resolveSession(): GameSession | null {
    const roomId: string | undefined = this.route.snapshot.params['roomId'];
    const current = this.sessions.current;
    if (!roomId) return current && current.mode !== 'online' ? current : null;
    if (current instanceof OnlineSession && current.roomId === roomId) return current;
    const seat = savedOnlineSeat();
    return seat?.roomId === roomId ? this.sessions.resumeOnline(seat) : null;
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  /** Undefined for the empty seat while an online room waits for player 2. */
  player(p: number): Player | undefined {
    return this.view()?.players[p];
  }

  soldier(p: number, slot: SlotKey): Soldier {
    return this.view()?.players[p]?.soldiers[slot] ?? EMPTY_SOLDIER;
  }

  color(p: number): string {
    return p === 0 ? 'var(--p1)' : 'var(--p2)';
  }

  aliveCount(p: number): number {
    const pl = this.view()?.players[p];
    return pl ? SOLDIER_SLOTS.filter((s) => pl.soldiers[s].alive).length : 5;
  }

  isTargetable(p: number, slot: SlotKey): boolean {
    const v = this.view();
    return this.choosing() && !!v && p !== v.currentTurn && this.soldier(p, slot).alive;
  }

  isShooter(p: number, slot: SlotKey): boolean {
    const v = this.view();
    return !!v && v.status === 'choosing_target' && v.currentTurn === p && v.pendingShooterSlot === slot;
  }

  label(p: number): string {
    const me = this.session?.me;
    if (me === p) return 'You';
    if (this.session?.mode === 'cpu' && p === 1) return 'CPU';
    return '';
  }

  opponentIndex(): number | null {
    const me = this.session?.me;
    return me === 0 ? 1 : me === 1 ? 0 : null;
  }

  // ── Player actions ────────────────────────────────────────────────────────

  roll(): void {
    if (!this.canRoll()) return;
    this.fx.play('tap');
    this.awaiting.set(true);
    this.session.roll();
  }

  target(p: number, slot: SlotKey): void {
    if (!this.isTargetable(p, slot)) return;
    this.awaiting.set(true);
    this.session.shoot(slot);
  }

  callCoin(choice: 'heads' | 'tails'): void {
    this.fx.play('tap');
    this.awaiting.set(true);
    this.session.coinToss(choice);
  }

  async rematch(): Promise<void> {
    this.fx.play('tap');
    await this.ads.maybeShowInterstitial();
    if (this.isOnline()) this.rematchAsked.set(true);
    this.session.rematch();
  }

  async goHome(): Promise<void> {
    const finished = this.view()?.status === 'finished';
    this.sessions.end();
    if (finished) await this.ads.maybeShowInterstitial();
    this.router.navigate(['/']);
  }

  onBack(): void {
    if (this.sheet()) this.sheet.set(null);
    else if (this.rollView()) this.skip$.next();
    else if (this.view()?.status === 'finished') this.goHome();
    else this.sheet.set('leave');
  }

  toggleSound(): void {
    this.settings.update({ sound: !this.settings.value().sound });
    this.fx.play('tap');
  }

  get soundOn(): boolean {
    return this.settings.value().sound;
  }

  skipAnimation(): void {
    this.skip$.next();
  }

  async shareCode(): Promise<void> {
    const code = this.view()?.roomId ?? '';
    const text = `Let's play 90s Gun Game! 🔫📖\nOpen the app → Play Online → Join friend → enter code: ${code}\n${environment.storeUrl}`;
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: '90s Gun Game', text, dialogTitle: 'Invite a friend' });
      else if (navigator.share) await navigator.share({ title: '90s Gun Game', text });
      else this.copyCode();
    } catch { /* share sheet dismissed */ }
  }

  copyCode(): void {
    const code = this.view()?.roomId ?? '';
    navigator.clipboard?.writeText(code).then(() => this.showToast('📋 Code copied')).catch(() => this.showToast(code));
  }

  // ── Event queue: play each event's animation, then show its state ─────────

  private enqueue(ev: SessionEvent): void {
    this.queue.push(ev);
    this.pump();
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    this.busy.set(true);
    while (this.queue.length && !this.destroyed) {
      const ev = this.queue.shift()!;
      try {
        await this.play(ev);
      } catch (err) {
        console.error('[board] event failed', err);
        if ('state' in ev) this.view.set(ev.state);
      }
    }
    this.pumping = false;
    this.busy.set(false);
    const v = this.view();
    if (v && !this.destroyed) this.session.onIdle(v);
  }

  private async play(ev: SessionEvent): Promise<void> {
    switch (ev.kind) {
      case 'error':
        this.showToast(`⚠ ${ev.message}`);
        if (ev.fatal) {
          await this.wait(1800);
          this.sessions.end();
          this.router.navigate(['/']);
        }
        return;

      case 'sync': {
        const before = this.view();
        this.view.set(ev.state);
        const opp = this.opponentIndex();
        const oppName = opp !== null ? ev.state.players[opp]?.name : '';
        if (ev.reason === 'opponent_joined') { this.showToast(`🎉 ${oppName} joined!`); this.fx.play('reveal'); }
        if (ev.reason === 'opponent_back') this.showToast(`${oppName} is back`);
        if (ev.reason === 'opponent_left') this.showToast(`${oppName} left the game`);
        if (ev.state.status === 'finished' && before?.status !== 'finished') this.resultOpen.set(true);
        return;
      }

      case 'coin': {
        const { outcome, state } = ev;
        const base = { callerName: state.players[0].name, result: outcome.result, winnerName: state.players[outcome.winnerIndex].name };
        this.coinAnim.set({ ...base, phase: 'flipping' });
        this.fx.play('coin');
        await this.wait(1850);
        this.coinAnim.set({ ...base, phase: 'result' });
        this.fx.play('reveal');
        await this.wait(1700);
        this.coinAnim.set(null);
        this.view.set(state);
        return;
      }

      case 'roll': {
        const { outcome: o, state } = ev;
        const player = state.players[o.playerIndex];
        this.rolledCell.set(null);
        this.rollView.set({
          phase: 'flip',
          playerName: player.name,
          color: this.color(o.playerIndex),
          rolledNum: o.rolledNum,
          leftPage: o.rolledNum + 10 * (1 + Math.floor(Math.random() * 18)),
          caption: describeRoll(o.action, player.soldiers[o.slot], o.rolledNum),
          tone: ROLL_TONE[o.action]
        });
        this.fx.play('flip');
        await this.wait(1250, true);
        this.rollView.update((r) => (r ? { ...r, phase: 'reveal' } : r));
        this.fx.play('reveal');
        this.fx.vibrate('light');
        await this.wait(1350, true);
        this.rollView.set(null);

        this.rolledCell.set(`${o.playerIndex}-${o.slot}`);
        this.view.set(state);
        if (o.action === 'GROW') this.fx.play('pencil');
        else if (o.action === 'DEAD') this.fx.play('thud');
        else if (o.action !== 'SHOOT') this.fx.play('load');
        await this.wait(o.action === 'SHOOT' ? 250 : 650);
        return;
      }

      case 'shot': {
        const { outcome: o, state } = ev;
        const enemy = o.shooterIndex === 0 ? 1 : 0;
        const shooterKey = `${o.shooterIndex}-${o.shooterSlot}`;
        this.shotFx.set(this.measureShot(shooterKey, `${enemy}-${o.targetSlot}`, o.shooterIndex, o.hit));
        this.flashCell.set(shooterKey);
        this.fx.play(o.hit ? 'bang' : 'miss');
        this.fx.vibrate(o.hit ? 'heavy' : 'light');
        await this.wait(380);
        this.view.set(state);
        if (o.hit) this.shake.set(true);
        await this.wait(900);
        this.shake.set(false);
        this.shotFx.set(null);
        this.flashCell.set(null);
        this.rolledCell.set(null);
        if (o.gameOver) await this.finishRound(state);
        return;
      }

      case 'rematch':
        this.view.set(ev.state);
        this.resultOpen.set(false);
        this.rematchAsked.set(false);
        this.rolledCell.set(null);
        this.showToast(`Round ${ev.state.round} — ${ev.state.players[ev.state.currentTurn].name} starts`);
        return;
    }
  }

  private async finishRound(state: GameState): Promise<void> {
    await this.wait(600);
    const me = this.session.me;
    const iWon = me === -1 ? null : state.winner === me;
    this.fx.play(iWon === false ? 'lose' : 'win');
    this.fx.vibrate(iWon === false ? 'error' : 'success');
    this.settings.recordRound(this.session.mode, iWon);
    this.ads.roundFinished();
    this.resultOpen.set(true);
  }

  /** Line from the shooter's gun to the centre of the target, in board pixels. */
  private measureShot(fromKey: string, toKey: string, shooterIndex: number, hit: boolean): ShotFx | null {
    const board = this.boardEl?.nativeElement;
    const from = board?.querySelector<HTMLElement>(`[data-cell="${fromKey}"]`);
    const to = board?.querySelector<HTMLElement>(`[data-cell="${toKey}"]`);
    if (!board || !from || !to) return null;
    const b = board.getBoundingClientRect();
    const f = from.getBoundingClientRect();
    const t = to.getBoundingClientRect();
    const x1 = (shooterIndex === 0 ? f.left + f.width * 0.82 : f.right - f.width * 0.82) - b.left;
    const y1 = f.top + f.height * 0.4 - b.top;
    let x2 = t.left + t.width / 2 - b.left;
    let y2 = t.top + t.height * 0.42 - b.top;
    if (!hit) y2 -= t.height * 0.45;
    if (!hit) x2 += (shooterIndex === 0 ? 1 : -1) * t.width * 0.3;
    return { w: b.width, h: b.height, x1, y1, x2, y2, hit };
  }

  private wait(ms: number, skippable = false): Promise<void> {
    const done = timer(ms);
    return firstValueFrom(skippable ? race(done, this.skip$) : done).then(() => undefined);
  }

  showToast(msg: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(msg);
    this.toastTimer = setTimeout(() => this.toast.set(''), 2800);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.sub?.unsubscribe();
    this.releaseBack?.();
    clearTimeout(this.toastTimer);
  }
}
