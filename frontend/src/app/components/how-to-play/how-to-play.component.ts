import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { SoldierComponent } from '../soldier/soldier.component';
import { Soldier } from '../../models/game.model';

@Component({
  selector: 'app-how-to-play',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SoldierComponent],
  host: { class: 'overlay-backdrop sheet-host', '(click)': 'close.emit()' },
  template: `
    <div class="sheet paper-card" (click)="$event.stopPropagation()" role="dialog" aria-label="How to play">
      <button class="icon-btn close" (click)="close.emit()" aria-label="Close">✕</button>
      <h2 class="h-title">How to Play</h2>
      <p class="lead">The last-bench classic: two players, one notebook, five soldiers each.</p>

      <ol class="steps">
        <li>
          <b>Open the book.</b> Look at the <u>left page</u> number — its last digit is your roll.
          Left pages are always even, so you get <span class="nums">0 2 4 6 8</span>.
          <div class="example">Page 4<span class="red">2</span> | 43 → <b>2</b></div>
        </li>
        <li>
          <b>Each number is one soldier.</b> Every time you roll it, that soldier gets the next part:
          <div class="stages">
            @for (s of stages; track s.label) {
              <figure><app-soldier [soldier]="s.soldier" color="var(--p1)" /><figcaption>{{ s.label }}</figcaption></figure>
            }
          </div>
        </li>
        <li><b>Load up.</b> After the gun, the next roll loads 6 bullets
          <small>(Classic rule: one bullet per roll)</small>.</li>
        <li><b>Shoot!</b> When a loaded soldier's number comes again, pick any enemy soldier — it gets the red ❌.
          Each shot uses one bullet. Empty gun? The next roll reloads.</li>
        <li><b>Dead soldier's number?</b> Bad luck — you lose that turn.</li>
        <li><b>Win</b> by crossing out all 5 enemy soldiers. 🏆</li>
      </ol>

      <button class="btn btn-primary wide" (click)="close.emit()">Got it — let's play!</button>
    </div>
  `,
  styles: `
    .close { position: absolute; top: 10px; right: 10px; }
    .lead { margin: 0 0 10px; color: var(--ink-soft); font-size: 18px; }
    .steps { margin: 0 0 16px; padding-left: 22px; font-size: 18px; line-height: 1.35; }
    .steps li { margin-bottom: 12px; }
    .steps small { color: var(--ink-soft); }
    .nums { font-family: var(--font-title); letter-spacing: .2em; color: var(--red); }
    .example { display: inline-block; margin-top: 4px; padding: 2px 10px; border: 2px dashed var(--ink-soft); border-radius: 8px; font-family: var(--font-title); }
    .red { color: var(--red); }
    .stages { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; margin-top: 6px; }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; height: 74px; }
    figcaption { font-size: 13px; color: var(--ink-soft); }
  `
})
export class HowToPlayComponent {
  readonly close = output<void>();

  readonly stages: { label: string; soldier: Soldier }[] = [
    { label: 'Head', soldier: { stage: 1, bullets: 0, alive: true } },
    { label: 'Body', soldier: { stage: 2, bullets: 0, alive: true } },
    { label: 'Legs', soldier: { stage: 3, bullets: 0, alive: true } },
    { label: 'Arms', soldier: { stage: 4, bullets: 0, alive: true } },
    { label: 'Gun', soldier: { stage: 5, bullets: 0, alive: true } },
    { label: 'Loaded', soldier: { stage: 11, bullets: 6, alive: true } }
  ];
}
