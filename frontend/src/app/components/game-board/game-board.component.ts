import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameService } from '../../services/game.service';
import {
  GameState, GameStatus, Soldier, SoldierMap,
  SOLDIER_SLOTS, SLOT_NUMBERS
} from '../../models/game.model';
import { SoldierCellComponent } from '../soldier-cell/soldier-cell.component';
import { GameLogComponent } from '../game-log/game-log.component';
import { BookFlipComponent } from '../book-flip/book-flip.component';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule, SoldierCellComponent, GameLogComponent, BookFlipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-board.component.html'
})
export class GameBoardComponent implements OnInit, OnDestroy {
  gameState: GameState | null = null;
  myPlayerIndex = -1;
  notification = '';
  /** Wrapped object so Angular always fires the book setter, even for repeated numbers */
  lastRollResult: { value: number; seq: number } | null = null;
  private rollSeq = 0;
  rollPopAnim = false;
  coinChoice: 'heads' | 'tails' | null = null;
  coinResult: string | null = null;
  /** True while the book-flip animation is running (suppress choosing_target UI) */
  flipInProgress = false;

  readonly soldierSlots = SOLDIER_SLOTS;
  readonly slotNumbers = SLOT_NUMBERS;

  private roomId = '';
  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.roomId = this.route.snapshot.params['roomId'];
    this.myPlayerIndex = this.gameService.getMyPlayerIndex();

    // If page was refreshed, try to rejoin
    if (this.myPlayerIndex === -1) {
      const saved = localStorage.getItem(`game_${this.roomId}`);
      if (saved !== null) {
        this.myPlayerIndex = parseInt(saved, 10);
        this.gameService.rejoinGame(this.roomId, this.myPlayerIndex);
      } else {
        this.router.navigate(['/']);
        return;
      }
    } else {
      localStorage.setItem(`game_${this.roomId}`, String(this.myPlayerIndex));
    }

    this.subs.push(
      this.gameService.gameState$.subscribe((state) => {
        this.gameState = state;
        // On reconnect / page-reload the book has no result yet — seed it from gameState.lastRoll
        if (
          state?.lastRoll !== null &&
          state?.lastRoll !== undefined &&
          this.lastRollResult === null
        ) {
          this.rollSeq++;
          this.lastRollResult = { value: state.lastRoll, seq: this.rollSeq };
        }
        this.cdr.markForCheck();
      }),

      this.gameService.notification$.subscribe((msg) => {
        this.notification = msg;
        this.cdr.markForCheck();
        setTimeout(() => { this.notification = ''; this.cdr.markForCheck(); }, 4000);
      }),

      this.gameService.lastAction$.subscribe(({ type, data }) => {
        if (type === 'ROLL_RESULT') {
          const d = data as { rolledNum: number; action: string; gameState: GameState };
          this.rollSeq++;
          this.lastRollResult = { value: d.rolledNum, seq: this.rollSeq };
          // Start the flip-in-progress timer here (when result arrives) not at click time
          this.flipInProgress = true;
          setTimeout(() => {
            this.flipInProgress = false;
            this.cdr.markForCheck();
          }, 1900);
          // Toast after book-flip animation (~1.8 s for own roll, quick for opponent)
          const isMine = d.gameState.currentTurn !== this.myPlayerIndex;
          const toastDelay = isMine ? 1800 : 400;
          this.showResultToast(d.gameState, toastDelay);
        }
        if (type === 'SHOOT_RESULT') {
          const d = data as { gameState: GameState };
          this.showResultToast(d.gameState, 0);
        }
        if (type === 'COIN_TOSS_RESULT') {
          const d = data as { result: string; winnerName: string };
          this.coinResult = `${d.result.toUpperCase()} — ${d.winnerName} goes first!`;
          this.cdr.markForCheck();
          setTimeout(() => { this.coinResult = null; this.cdr.markForCheck(); }, 3500);
        }
        this.cdr.markForCheck();
      })
    );

    // Sync initial state from service (in case we already have it)
    this.gameState = this.gameService.getGameState();
  }

  // ── Derived helpers ─────────────────────────────────────────────────────────

  get isMyTurn(): boolean {
    return this.gameState?.currentTurn === this.myPlayerIndex;
  }

  get canRoll(): boolean {
    return this.gameState?.status === 'playing' && this.isMyTurn;
  }

  get isChoosingTarget(): boolean {
    return (
      this.gameState?.status === 'choosing_target' &&
      this.gameState?.currentTurn === this.myPlayerIndex &&
      !this.flipInProgress   // don't show until flip animation finishes
    );
  }

  get isWaitingForOpponent(): boolean {
    const s = this.gameState?.status as GameStatus | undefined;
    return s === 'choosing_target' && !this.isChoosingTarget && !this.flipInProgress;
  }

  get myName(): string {
    if (!this.gameState || this.myPlayerIndex === -1) return '';
    return this.gameState.players[this.myPlayerIndex]?.name ?? '';
  }

  get opponentName(): string {
    if (!this.gameState || this.myPlayerIndex === -1) return '';
    const opIdx = this.myPlayerIndex === 0 ? 1 : 0;
    return this.gameState.players[opIdx]?.name ?? '…';
  }

  getSoldier(playerIndex: number, slot: string): Soldier {
    const fallback: Soldier = { stage: 0, bullets: 0, alive: true };
    if (!this.gameState) return fallback;
    const player = this.gameState.players[playerIndex];
    if (!player) return fallback;
    return player.soldiers[slot as keyof SoldierMap] ?? fallback;
  }

  isTargetable(playerIndex: number, slot: string): boolean {
    if (!this.isChoosingTarget) return false;
    const enemyIndex = this.myPlayerIndex === 0 ? 1 : 0;
    if (playerIndex !== enemyIndex) return false;
    return this.getSoldier(playerIndex, slot).alive;
  }

  getFacing(playerIndex: number): 'right' | 'left' {
    // Player 0 on left faces right; Player 1 on right faces left
    return playerIndex === 0 ? 'right' : 'left';
  }

  getCurrentTurnName(): string {
    if (!this.gameState) return '';
    return this.gameState.players[this.gameState.currentTurn]?.name ?? '';
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  roll(): void {
    if (this.canRoll) {
      this.gameService.roll(this.roomId);
    }
  }

  chooseCoin(choice: 'heads' | 'tails'): void {
    this.coinChoice = choice;
    this.gameService.flipCoin(this.roomId, choice);
  }

  shootTarget(slot: string): void {
    if (this.isChoosingTarget) {
      this.gameService.shoot(this.roomId, slot);
    }
  }

  copyRoomId(): void {
    navigator.clipboard.writeText(this.roomId);
    this.notification = '📋 Room code copied!';
    setTimeout(() => (this.notification = ''), 2000);
    this.cdr.markForCheck();
  }

  newGame(): void {
    localStorage.removeItem(`game_${this.roomId}`);
    this.router.navigate(['/']);
  }

  /** Show the last log entry as a temporary toast after `delayMs`. */
  private showResultToast(gs: GameState | null, delayMs: number): void {
    if (!gs?.log?.length) return;
    const msg = gs.log[gs.log.length - 1].message;
    setTimeout(() => {
      this.notification = msg;
      this.cdr.markForCheck();
      setTimeout(() => { this.notification = ''; this.cdr.markForCheck(); }, 3500);
    }, delayMs);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
