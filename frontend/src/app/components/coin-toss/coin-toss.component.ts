import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface CoinView {
  phase: 'choose' | 'waiting' | 'flipping' | 'result';
  callerName: string;
  result?: 'heads' | 'tails';
  winnerName?: string;
}

@Component({
  selector: 'app-coin-toss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="paper-card coin-card">
      <h2 class="title">Coin Toss</h2>

      <div class="coin-stage">
        <div class="coin" [class.spinning]="view().phase === 'flipping'"
             [class.show-tails]="view().phase !== 'choose' && view().result === 'tails'">
          <div class="face heads"><span class="ta">தலை</span><b>HEADS</b></div>
          <div class="face tails"><span class="ta">பூ</span><b>TAILS</b></div>
        </div>
        <div class="shadow" [class.spinning]="view().phase === 'flipping'"></div>
      </div>

      @switch (view().phase) {
        @case ('choose') {
          <p class="sub">{{ view().callerName }}, call it!</p>
          <div class="choices">
            <button class="btn btn-primary" (click)="choose.emit('heads')">Heads <small>(Thalai)</small></button>
            <button class="btn btn-secondary" (click)="choose.emit('tails')">Tails <small>(Poo)</small></button>
          </div>
        }
        @case ('waiting') { <p class="sub dots">{{ view().callerName }} is calling the toss</p> }
        @case ('flipping') { <p class="sub">The coin is in the air…</p> }
        @case ('result') {
          <p class="verdict">{{ view().result === 'heads' ? 'HEADS!' : 'TAILS!' }}</p>
          <p class="sub"><b>{{ view().winnerName }}</b> starts first</p>
        }
      }
    </div>
  `,
  styles: `
    .coin-card { text-align: center; padding: 22px 18px 24px; width: 100%; max-width: 380px; }
    .title { font-family: var(--font-title); font-size: 30px; margin: 0; }
    .coin-stage { height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; perspective: 600px; }
    .coin { position: relative; width: 104px; height: 104px; transform-style: preserve-3d; transition: transform .6s; }
    .coin.show-tails { transform: rotateY(180deg); }
    .coin.spinning { animation: coin-spin 1.8s cubic-bezier(.25,.6,.35,1) both; }
    .coin.spinning.show-tails { animation-name: coin-spin-tails; }
    .face { position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: radial-gradient(circle at 35% 30%, #fff3b0, #e9b949 45%, #b7791f); border: 4px solid #8a5a12;
            box-shadow: inset 0 0 0 5px rgba(255,255,255,.25), 0 4px 0 #6b450c; color: #5b3a06; }
    .face.tails { transform: rotateY(180deg); }
    .face .ta { font-size: 30px; font-weight: 700; line-height: 1.1; }
    .face b { font-size: 13px; letter-spacing: .12em; }
    .shadow { width: 80px; height: 12px; margin-top: 12px; border-radius: 50%; background: rgba(0,0,0,.18); }
    .shadow.spinning { animation: coin-shadow 1.8s ease-in-out both; }
    @keyframes coin-spin {
      0% { transform: translateY(0) rotateY(0) }
      45% { transform: translateY(-70px) rotateY(1440deg) }
      100% { transform: translateY(0) rotateY(2880deg) }
    }
    @keyframes coin-spin-tails {
      0% { transform: translateY(0) rotateY(0) }
      45% { transform: translateY(-70px) rotateY(1440deg) }
      100% { transform: translateY(0) rotateY(3060deg) }
    }
    @keyframes coin-shadow { 45% { transform: scale(.5); opacity: .4 } }
    .sub { font-size: 20px; margin: 6px 0 14px; color: var(--ink-soft); }
    .verdict { font-family: var(--font-title); font-size: 34px; margin: 0; color: var(--red); animation: pop-in .4s cubic-bezier(.3,1.7,.5,1) both; }
    .choices { display: flex; gap: 12px; justify-content: center; }
    .choices .btn { flex: 1; flex-direction: column; gap: 0; padding: 12px 8px; }
    .choices small { font-size: 14px; opacity: .85; }
  `
})
export class CoinTossComponent {
  readonly view = input.required<CoinView>();
  readonly choose = output<'heads' | 'tails'>();
}
