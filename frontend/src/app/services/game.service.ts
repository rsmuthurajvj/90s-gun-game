import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { SocketService } from './socket.service';
import { GameState, SOLDIER_SLOTS } from '../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameService implements OnDestroy {
  private _gameState$ = new BehaviorSubject<GameState | null>(null);
  private _myPlayerIndex$ = new BehaviorSubject<number>(-1);
  private _lastAction$ = new Subject<{ type: string; data: unknown }>();
  private _notification$ = new Subject<string>();
  private sub!: Subscription;

  readonly gameState$ = this._gameState$.asObservable();
  readonly myPlayerIndex$ = this._myPlayerIndex$.asObservable();
  readonly lastAction$ = this._lastAction$.asObservable();
  readonly notification$ = this._notification$.asObservable();

  constructor(private socket: SocketService) {
    this.socket.connect();
    this.sub = this.socket.events$.subscribe(({ event, data }) =>
      this.handleEvent(event, data as Record<string, unknown>)
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  createGame(playerName: string): void {
    this.socket.emit('create_game', { playerName });
  }

  joinGame(roomId: string, playerName: string): void {
    this.socket.emit('join_game', { roomId: roomId.toUpperCase().trim(), playerName });
  }

  rejoinGame(roomId: string, playerIndex: number): void {
    this.socket.emit('rejoin_game', { roomId, playerIndex });
  }

  flipCoin(roomId: string, choice: 'heads' | 'tails'): void {
    this.socket.emit('coin_toss', { roomId, choice });
  }

  roll(roomId: string): void {
    this.socket.emit('roll', { roomId });
  }

  shoot(roomId: string, targetSlot: string): void {
    this.socket.emit('shoot', { roomId, targetSlot });
  }

  getMyPlayerIndex(): number {
    return this._myPlayerIndex$.getValue();
  }

  getGameState(): GameState | null {
    return this._gameState$.getValue();
  }

  // ── Event handling ──────────────────────────────────────────────────────────

  private handleEvent(event: string, data: Record<string, unknown>): void {
    switch (event) {
      case 'game_created':
        this._myPlayerIndex$.next(data['playerIndex'] as number);
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'GAME_CREATED', data });
        break;

      case 'game_joined':
        this._myPlayerIndex$.next(data['playerIndex'] as number);
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'GAME_JOINED', data });
        break;

      case 'rejoined':
        this._myPlayerIndex$.next(data['playerIndex'] as number);
        this._gameState$.next(data['gameState'] as GameState);
        this._notification$.next('Reconnected to game!');
        break;

      case 'opponent_joined':
        this._gameState$.next(data['gameState'] as GameState);
        this._notification$.next(`${data['opponentName']} joined! Time for the coin toss.`);
        this._lastAction$.next({ type: 'OPPONENT_JOINED', data });
        break;

      case 'coin_toss_result':
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'COIN_TOSS_RESULT', data });
        break;

      case 'roll_result':
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'ROLL_RESULT', data });
        break;

      case 'choose_target':
        this._gameState$.next(data['gameState'] as GameState);
        this._notification$.next('Choose an enemy soldier to shoot!');
        this._lastAction$.next({ type: 'CHOOSE_TARGET', data });
        break;

      case 'opponent_choosing':
        this._gameState$.next(data['gameState'] as GameState);
        this._notification$.next('Opponent is choosing a target…');
        // Also emit ROLL_RESULT so the opponent's book flip shows the number
        this._lastAction$.next({ type: 'ROLL_RESULT', data });
        break;

      case 'shoot_result':
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'SHOOT_RESULT', data });
        break;

      case 'game_over':
        this._gameState$.next(data['gameState'] as GameState);
        this._lastAction$.next({ type: 'GAME_OVER', data });
        break;

      case 'error':
        this._notification$.next(`⚠ ${(data as { message: string }).message}`);
        break;
    }
  }

  /** Returns alive enemy soldiers for target selection */
  getAliveEnemySlots(): string[] {
    const state = this._gameState$.getValue();
    const me = this._myPlayerIndex$.getValue();
    if (!state || me === -1) return [];
    const enemyIndex = me === 0 ? 1 : 0;
    const enemy = state.players[enemyIndex];
    if (!enemy) return [];
    return SOLDIER_SLOTS.filter((s) => enemy.soldiers[s]?.alive);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.socket.disconnect();
  }
}
