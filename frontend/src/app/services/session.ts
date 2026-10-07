import { Observable, Subject, Subscription, filter, firstValueFrom, map, race, timer } from 'rxjs';
import {
  CoinOutcome, GameState, RollOutcome, Rules, ShotOutcome, SlotKey
} from '../models/game.model';
import * as engine from '../game/engine';
import { chooseCpuTarget } from '../game/cpu';
import { SocketService } from './socket.service';

export type SessionMode = 'local' | 'cpu' | 'online';

/**
 * Everything the game screen needs to animate, in order. Each event carries
 * the full state *after* it happened; the board shows that state only once
 * the event's animation has played.
 */
export type SessionEvent =
  | { kind: 'sync'; state: GameState; reason?: string }
  | { kind: 'coin'; outcome: CoinOutcome; state: GameState }
  | { kind: 'roll'; outcome: RollOutcome; state: GameState }
  | { kind: 'shot'; outcome: ShotOutcome; state: GameState }
  | { kind: 'rematch'; state: GameState }
  | { kind: 'error'; message: string; fatal?: boolean };

export interface GameSession {
  readonly mode: SessionMode;
  readonly events$: Observable<SessionEvent>;
  /** Latest authoritative state (may be ahead of what the board shows). */
  readonly state: GameState | null;
  /** Seat the UI speaks to as "you". -1 in Pass & Play (both seats are local). */
  readonly me: number;
  controls(playerIndex: number): boolean;
  coinToss(choice: 'heads' | 'tails'): void;
  roll(): void;
  shoot(slot: SlotKey): void;
  rematch(): void;
  leave(): void;
  /** The board calls this whenever it has finished animating everything. */
  onIdle(view: GameState): void;
}

const clone = (s: GameState): GameState => structuredClone(s);

// ── Offline: Pass & Play and vs Computer ────────────────────────────────────

export const CPU_SEAT = 1;

export class LocalSession implements GameSession {
  private readonly subject = new Subject<SessionEvent>();
  readonly events$ = this.subject.asObservable();
  private game: GameState;
  private cpuTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly mode: 'local' | 'cpu', names: [string, string], rules: Rules, private cpuEasy = false) {
    this.game = engine.newLocalGame(names, rules);
  }

  get state(): GameState { return clone(this.game); }
  get me(): number { return this.mode === 'cpu' ? 0 : -1; }

  controls(playerIndex: number): boolean {
    return this.mode === 'local' || playerIndex !== CPU_SEAT;
  }

  coinToss(choice: 'heads' | 'tails'): void {
    this.act(() => {
      const outcome = engine.coinToss(this.game, 0, choice);
      this.subject.next({ kind: 'coin', outcome, state: this.state });
    });
  }

  roll(): void { this.doRoll(this.game.currentTurn, false); }
  shoot(slot: SlotKey): void { this.doShoot(this.game.currentTurn, slot, false); }

  rematch(): void {
    this.act(() => {
      engine.startRematch(this.game);
      this.subject.next({ kind: 'rematch', state: this.state });
    });
  }

  leave(): void {
    if (this.cpuTimer) clearTimeout(this.cpuTimer);
    this.subject.complete();
  }

  onIdle(view: GameState): void {
    if (this.mode !== 'cpu' || this.cpuTimer || view.currentTurn !== CPU_SEAT) return;
    if (view.status === 'playing') {
      this.cpuTimer = setTimeout(() => { this.cpuTimer = null; this.doRoll(CPU_SEAT, true); }, 700);
    } else if (view.status === 'choosing_target') {
      this.cpuTimer = setTimeout(() => {
        this.cpuTimer = null;
        this.doShoot(CPU_SEAT, chooseCpuTarget(this.game, CPU_SEAT, this.cpuEasy), true);
      }, 1100);
    }
  }

  private doRoll(seat: number, asCpu: boolean): void {
    if (!asCpu && !this.controls(seat)) return;
    this.act(() => {
      const outcome = engine.roll(this.game, seat);
      this.subject.next({ kind: 'roll', outcome, state: this.state });
    });
  }

  private doShoot(seat: number, slot: SlotKey, asCpu: boolean): void {
    if (!asCpu && !this.controls(seat)) return;
    this.act(() => {
      const outcome = engine.shoot(this.game, seat, slot);
      this.subject.next({ kind: 'shot', outcome, state: this.state });
    });
  }

  private act(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this.subject.next({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  }
}

// ── Online (Socket.io) ───────────────────────────────────────────────────────

const ONLINE_KEY = 'ggg.online';

export interface OnlineSeat {
  roomId: string;
  token: string;
  playerIndex: number;
}

export function savedOnlineSeat(): OnlineSeat | null {
  try {
    const raw = localStorage.getItem(ONLINE_KEY);
    return raw ? (JSON.parse(raw) as OnlineSeat) : null;
  } catch {
    return null;
  }
}

function saveOnlineSeat(seat: OnlineSeat | null): void {
  try {
    if (seat) localStorage.setItem(ONLINE_KEY, JSON.stringify(seat));
    else localStorage.removeItem(ONLINE_KEY);
  } catch { /* storage unavailable: reconnect after reload just won't work */ }
}

export class OnlineSession implements GameSession {
  readonly mode = 'online' as const;
  private readonly subject = new Subject<SessionEvent>();
  readonly events$ = this.subject.asObservable();
  private latest: GameState | null;
  private readonly sub: Subscription;

  private constructor(private socket: SocketService, private seat: OnlineSeat, initial: GameState | null) {
    this.latest = initial;
    saveOnlineSeat(seat);
    this.sub = socket.events$.subscribe(({ event, data }) => this.handle(event, data));
  }

  /** Create a room or join one; resolves once the server confirms. */
  static async open(
    socket: SocketService,
    request: { create: true; name: string; rules: Rules } | { create: false; name: string; roomId: string }
  ): Promise<OnlineSession> {
    socket.connect();
    const ok = request.create ? 'game_created' : 'game_joined';
    const reply = firstValueFrom(
      race(
        socket.events$.pipe(filter((e) => e.event === ok || e.event === 'game_error')),
        timer(65000).pipe(map(() => ({ event: 'game_error', data: { message: 'Server is not responding. Check your internet and try again.' } })))
      )
    );
    if (request.create) socket.emit('create_game', { playerName: request.name, rules: request.rules });
    else socket.emit('join_game', { playerName: request.name, roomId: request.roomId });

    const { event, data } = await reply;
    if (event === 'game_error') throw new Error(data?.message ?? 'Could not connect.');
    const state = data.gameState as GameState;
    return new OnlineSession(socket, { roomId: state.roomId, token: data.token, playerIndex: data.playerIndex }, state);
  }

  /** Reconnect to a seat saved earlier (page reload / app restart). */
  static resume(socket: SocketService, seat: OnlineSeat): OnlineSession {
    const session = new OnlineSession(socket, seat, null);
    socket.connect();
    if (socket.connected) session.rejoin();
    return session;
  }

  get roomId(): string { return this.seat.roomId; }
  get state(): GameState | null { return this.latest; }
  get me(): number { return this.seat.playerIndex; }
  controls(playerIndex: number): boolean { return playerIndex === this.seat.playerIndex; }

  coinToss(choice: 'heads' | 'tails'): void { this.send('coin_toss', { choice }); }
  roll(): void { this.send('roll'); }
  shoot(slot: SlotKey): void { this.send('shoot', { targetSlot: slot }); }
  rematch(): void { this.send('rematch'); }

  leave(): void {
    this.send('leave_game');
    saveOnlineSeat(null);
    this.sub.unsubscribe();
    this.subject.complete();
  }

  onIdle(): void { /* the opponent acts from their own device */ }

  private rejoin(): void {
    this.socket.emit('rejoin_game', { roomId: this.seat.roomId, token: this.seat.token });
  }

  private send(event: string, extra: Record<string, unknown> = {}): void {
    if (!this.socket.connected) {
      this.subject.next({ kind: 'error', message: 'No connection — reconnecting…' });
      return;
    }
    this.socket.emit(event, { roomId: this.seat.roomId, ...extra });
  }

  private handle(event: string, data: any): void {
    if (event === 'connect') return this.rejoin();
    if (event === 'game_error') return this.subject.next({ kind: 'error', message: data?.message ?? 'Error' });
    if (event === 'rejoin_failed') {
      saveOnlineSeat(null);
      return this.subject.next({ kind: 'error', message: data?.message ?? 'Game not found.', fatal: true });
    }

    const state = data?.gameState as GameState | undefined;
    if (!state || state.roomId !== this.seat.roomId) return;
    this.latest = state;

    switch (event) {
      case 'rejoined': return this.subject.next({ kind: 'sync', state, reason: 'rejoined' });
      case 'state': return this.subject.next({ kind: 'sync', state, reason: data.reason });
      case 'coin_result': return this.subject.next({ kind: 'coin', outcome: data, state });
      case 'roll_result': return this.subject.next({ kind: 'roll', outcome: data, state });
      case 'shot_result': return this.subject.next({ kind: 'shot', outcome: data, state });
      case 'rematch_started': return this.subject.next({ kind: 'rematch', state });
    }
  }
}
