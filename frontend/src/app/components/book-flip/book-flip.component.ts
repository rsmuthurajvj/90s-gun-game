import {
  Component, Input, Output, EventEmitter, OnChanges,
  SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Page pools: left page number for each result digit
const PAGE_POOLS: Record<number, number[]> = {
  0: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140],
  2: [12, 22, 32, 42, 52, 62, 72, 82, 92, 102, 112, 122, 132, 142],
  4: [14, 24, 34, 44, 54, 64, 74, 84, 94, 104, 114, 124, 134, 144],
  6: [16, 26, 36, 46, 56, 66, 76, 86, 96, 106, 116, 126, 136, 146],
  8: [18, 28, 38, 48, 58, 68, 78, 88, 98, 108, 118, 128, 138, 148],
};

@Component({
  selector: 'app-book-flip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="book-panel">
      <div class="book-panel-title">📚 The Book</div>

      <!-- Book visual -->
      <div class="book-visual-wrap" [class.book-ready]="canFlip && !isFlipping">

        <!-- Open book pages -->
        <div class="open-book">

          <!-- Left page -->
          <div class="book-page bpl">
            <span class="pgn pgn-tl">{{ isRevealed ? leftPage : '??' }}</span>
            <div class="book-pg-lines">
              <div *ngFor="let w of lineWidths" class="bpl-line" [style.width.%]="w"></div>
            </div>
            <span class="pgn pgn-bl">{{ isRevealed ? leftPage : '??' }}</span>
          </div>

          <!-- Spine -->
          <div class="book-spine-v"></div>

          <!-- Right page -->
          <div class="book-page bpr">
            <span class="pgn pgn-tr">{{ isRevealed ? rightPage : '??' }}</span>
            <div class="book-pg-lines">
              <div *ngFor="let w of lineWidths" class="bpl-line" [style.width.%]="w"></div>
            </div>
            <span class="pgn pgn-br">{{ isRevealed ? rightPage : '??' }}</span>
          </div>

          <!-- Animated flip sheet (CSS 3D page turn) -->
          <div class="flip-sheet" [class.flip-go]="isFlipping"></div>
        </div>

        <!-- Book bottom shadow / depth -->
        <div class="book-depth"></div>
      </div>

      <!-- Result reveal -->
      <div class="book-result-area">
        <div *ngIf="isRevealed" class="book-result anim-fade-in">
          <div class="br-formula">
            Pages&nbsp;<strong>{{ leftPage }}</strong>&nbsp;&amp;&nbsp;<strong>{{ rightPage }}</strong>
          </div>
          <div class="br-digit anim-roll-pop">{{ currentResult }}</div>
          <div class="br-sub">last digit of page {{ leftPage }}</div>
        </div>
        <div *ngIf="!isRevealed && !isFlipping" class="book-idle-hint">
          <span *ngIf="canFlip">Open the book to roll!</span>
          <span *ngIf="!canFlip && !waitMessage">Waiting…</span>
          <span *ngIf="waitMessage">{{ waitMessage }}</span>
        </div>
        <div *ngIf="isFlipping" class="book-idle-hint flipping-hint">Flipping pages…</div>
      </div>

      <!-- Action button -->
      <button
        class="btn book-action-btn"
        [class.btn-orange]="canFlip && !isFlipping"
        [class.btn-gray]="!canFlip || isFlipping"
        (click)="flip()"
        [disabled]="!canFlip || isFlipping"
      >
        {{ btnLabel }}
      </button>
    </div>
  `
})
export class BookFlipComponent implements OnChanges {
  @Input() canFlip = false;
  @Input() waitMessage = '';
  /** Wrapped in { value, seq, animate } so the setter fires even for repeated rolls.
   *  animate=true  → start flip if not already flipping (covers the opponent's view)
   *  animate=false → show the result immediately (reconnect / seed)
   */
  @Input() set lastResult(val: { value: number; seq: number; animate?: boolean } | null) {
    if (!val) return;
    const num = val.value;

    // For the opponent (or anyone who didn't click the button),
    // kick off the flip animation now so both players see it.
    if (val.animate && !this.isFlipping) {
      this.isFlipping = true;
      this.isRevealed = false;
      this.currentResult = null;
      this.cdr.markForCheck();
    }

    // Reveal mid-way through the final flip (~1.55 s), or instantly for seeds
    const delay = this.isFlipping ? 1550 : 0;
    setTimeout(() => {
      const pool = PAGE_POOLS[num] ?? [42];
      this.leftPage = pool[Math.floor(Math.random() * pool.length)];
      this.rightPage = this.leftPage + 1;
      this.currentResult = num;
      this.isRevealed = true;
      this.isFlipping = false;
      this.cdr.markForCheck();
    }, delay);
  }
  @Output() flipRequested = new EventEmitter<void>();

  isFlipping = false;
  isRevealed = false;
  leftPage = 0;
  rightPage = 0;
  currentResult: number | null = null;

  readonly lineWidths = [92, 80, 96, 70, 88, 75, 95, 60];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {}

  flip(): void {
    if (!this.canFlip || this.isFlipping) return;
    this.isFlipping = true;
    this.isRevealed = false;
    this.currentResult = null;
    this.flipRequested.emit();
    this.cdr.markForCheck();

    // Safety timeout: 6×0.22s ruffles + 0.48s final = ~1.85s total
    setTimeout(() => {
      if (this.isFlipping) {
        this.isFlipping = false;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  get btnLabel(): string {
    if (this.isFlipping) return 'Flipping…';
    if (!this.canFlip) return 'Waiting…';
    return '📖 Open Book';
  }
}
