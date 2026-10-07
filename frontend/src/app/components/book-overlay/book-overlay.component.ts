import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface RollView {
  phase: 'flip' | 'reveal';
  playerName: string;
  color: string;
  rolledNum: number;
  leftPage: number;
  caption: string;
  tone: 'good' | 'bad' | 'shoot';
}

/** Full-screen "open the book" animation shown for every roll. Tap to skip. */
@Component({
  selector: 'app-book-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'overlay-backdrop', '(click)': 'skip.emit()' },
  template: `
    <div class="wrap" [style.--who]="view().color">
      <div class="who">{{ view().playerName }} opens the book…</div>

      <div class="book" [class.flipping]="view().phase === 'flip'">
        <div class="cover"></div>
        <div class="page left">
          <span class="pg">
            @if (view().phase === 'reveal') {
              {{ tens() }}<span class="last">{{ view().rolledNum }}
                <svg viewBox="0 0 40 40" class="circle"><ellipse class="ink-red" pathLength="1" cx="20" cy="21" rx="16" ry="15" /></svg>
              </span>
            } @else { ?? }
          </span>
          <div class="lines">@for (w of lines; track $index) { <i [style.width.%]="w"></i> }</div>
        </div>
        <div class="page right">
          <span class="pg">{{ view().phase === 'reveal' ? view().leftPage + 1 : '??' }}</span>
          <div class="lines">@for (w of lines; track $index) { <i [style.width.%]="100 - w / 3"></i> }</div>
        </div>
        @if (view().phase === 'flip') {
          <div class="sheet s1"></div><div class="sheet s2"></div><div class="sheet s3"></div>
        }
      </div>

      <div class="result">
        @if (view().phase === 'reveal') {
          <div class="digit">{{ view().rolledNum }}</div>
          <div class="caption" [class]="'tone-' + view().tone">{{ view().caption }}</div>
        } @else {
          <div class="hint">flipping pages…</div>
        }
      </div>
      <div class="skip">tap to skip</div>
    </div>
  `,
  styles: `
    .wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 360px; }
    .who { font-family: var(--font-title); font-size: 22px; color: #fff; text-shadow: 0 2px 0 var(--who); text-align: center; }
    .book { position: relative; width: 300px; max-width: 86vw; aspect-ratio: 300 / 200; display: flex; perspective: 900px; }
    .cover { position: absolute; inset: -9px -10px -12px; border-radius: 8px; background: var(--kraft);
             background-image: repeating-linear-gradient(45deg, rgba(0,0,0,.03) 0 2px, transparent 2px 6px);
             box-shadow: 0 14px 30px rgba(0,0,0,.45); }
    .page { position: relative; flex: 1; background: #fffdf5; padding: 10px; overflow: hidden;
            background-image: repeating-linear-gradient(transparent 0 15px, #d6e4f3 15px 16px); }
    .page.left { border-radius: 4px 0 0 4px; box-shadow: inset -14px 0 18px -12px rgba(0,0,0,.35); }
    .page.right { border-radius: 0 4px 4px 0; box-shadow: inset 14px 0 18px -12px rgba(0,0,0,.35); text-align: right; }
    .pg { position: relative; z-index: 1; font-family: var(--font-title); font-size: 26px; color: var(--ink); background: #fffdf5; padding: 0 4px; }
    .last { position: relative; display: inline-block; color: var(--red); }
    .circle { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; transform: translate(-50%, -50%) rotate(-12deg); overflow: visible; }
    .ink-red { fill: none; stroke: var(--red); stroke-width: 2.6; stroke-dasharray: 1; stroke-dashoffset: 1; animation: ink-draw .45s .1s ease-out forwards; }
    .lines { display: flex; flex-direction: column; gap: 7px; margin-top: 12px; }
    .lines i { display: block; height: 3px; border-radius: 2px; background: #c9ccd6; opacity: .55; margin-left: auto; }
    .page.left .lines i { margin-left: 0; }
    .sheet { position: absolute; top: 0; right: 0; width: 50%; height: 100%; background: #fffaf0; border-radius: 0 4px 4px 0;
             transform-origin: left center; box-shadow: inset 10px 0 16px -10px rgba(0,0,0,.3);
             animation: riffle .4s ease-in-out infinite; backface-visibility: visible; }
    .sheet.s2 { animation-delay: .13s; background: #fff7e6; }
    .sheet.s3 { animation-delay: .26s; }
    @keyframes riffle { 0% { transform: rotateY(0) } 55% { transform: rotateY(-175deg) } 100% { transform: rotateY(-180deg); opacity: .6 } }
    .result { min-height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .digit { font-family: var(--font-title); font-size: 64px; line-height: 1; color: #fff; text-shadow: 3px 3px 0 var(--red); animation: pop .45s cubic-bezier(.3,1.7,.5,1) both; }
    .caption { margin-top: 6px; font-size: 21px; padding: 4px 14px; border-radius: 999px; background: #fff; color: var(--ink); border: 2px solid var(--ink);
               animation: fade-in .3s .15s both; text-align: center; }
    .caption.tone-bad { background: #ffe3e3; color: #9b1c1c; }
    .caption.tone-shoot { background: var(--red); color: #fff; border-color: #7f1010; }
    .hint { color: #f1ead6; font-size: 18px; animation: blink 1s infinite; }
    .skip { color: rgba(255,255,255,.5); font-size: 14px; }
    @keyframes pop { from { transform: scale(.2) rotate(-20deg); opacity: 0 } to { transform: scale(1) rotate(0); opacity: 1 } }
  `
})
export class BookOverlayComponent {
  readonly view = input.required<RollView>();
  readonly skip = output<void>();

  readonly lines = [92, 78, 96, 64, 88, 71, 94, 58];
  readonly tens = computed(() => Math.floor(this.view().leftPage / 10));
}
