import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FULL_AMMO, GUN_STAGE, MAX_STAGE, Soldier } from '../../models/game.model';

/**
 * A notebook stick soldier. Parts are drawn with `pathLength=1` so each one
 * "inks in" (stroke-dashoffset animation) the moment it is added.
 */
@Component({
  selector: 'app-soldier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.dead]': '!soldier().alive',
    '[class.empty]': 'soldier().stage === 0 && soldier().alive',
    '[class.ready]': 'isReady()',
    '[style.--ink]': 'color()'
  },
  template: `
    <svg viewBox="0 0 100 100" class="fig" aria-hidden="true">
      <g [attr.transform]="facing() === 'left' ? 'translate(100 0) scale(-1 1)' : null">
        @if (soldier().stage === 0) {
          <!-- ghost outline: a soldier still to be drawn -->
          <g class="ghost">
            <circle cx="38" cy="17" r="10" />
            <path d="M38 27 V62 M38 62 L28 89 M38 62 L50 89 M38 38 L26 54 M38 38 L60 44" />
          </g>
        }
        @if (soldier().stage >= 1) { <circle class="ink" pathLength="1" cx="38" cy="17" r="10" /> }
        @if (soldier().stage >= 1 && soldier().alive) {
          <g class="face">
            <circle cx="41.5" cy="15" r="1.3" />
            <path d="M37 21 Q40.5 23 44 20.5" />
          </g>
        }
        @if (soldier().stage >= 2) { <path class="ink" pathLength="1" d="M38 27 Q39.5 45 38 62" /> }
        @if (soldier().stage >= 3) {
          <path class="ink" pathLength="1" d="M38 62 Q33 75 28 89 l-5 1" />
          <path class="ink" pathLength="1" d="M38 62 Q44 75 50 89 l5 0" />
        }
        @if (soldier().stage >= 4) {
          <path class="ink" pathLength="1" d="M38 37 Q31 46 25 53" />
          <path class="ink" pathLength="1" d="M38 37 Q49 42 60 44" />
        }
        @if (soldier().stage >= 5) {
          <g class="gun">
            <path d="M57 38.5 h27 a1.5 1.5 0 0 1 1.5 1.5 v3.5 h-17 l-3.2 8.5 h-6.2 l2.6-8.5 h-4.7 z" />
            <path class="sight" d="M81 38.5 v-2.5" />
          </g>
        }
        @if (flash()) {
          <g class="flash">
            <path d="M88 41 l9 -6 l-4 7 l7 2 l-8 2 l4 7 l-8 -5 z" />
          </g>
        }
      </g>
      @if (!soldier().alive) {
        <g class="x-mark">
          <path class="ink" pathLength="1" d="M14 10 Q50 50 86 92" />
          <path class="ink" pathLength="1" d="M86 8 Q48 52 14 90" />
        </g>
      }
    </svg>
    @if (soldier().stage >= gunStage && soldier().alive) {
      <div class="ammo" [attr.aria-label]="ammo() + ' bullets'">
        @for (b of ammoSlots; track $index) {
          <i [class.full]="$index < ammo()"></i>
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; position: relative; }
    .fig { width: 100%; height: 100%; max-height: 92px; overflow: visible; flex: 1; min-height: 0; }
    .ink { fill: none; stroke: var(--ink); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round;
           stroke-dasharray: 1; stroke-dashoffset: 1; animation: ink-draw .55s ease-out forwards; }
    .face { fill: var(--ink); stroke: var(--ink); stroke-width: 1.6; stroke-linecap: round; animation: fade-in .4s .35s both; }
    .face path { fill: none; }
    .gun { fill: var(--ink); stroke: var(--ink); stroke-width: 1; stroke-linejoin: round; transform-origin: 70px 44px; animation: pop-in .4s cubic-bezier(.3,1.6,.5,1) both; }
    .gun .sight { stroke-width: 2; }
    .ghost { fill: none; stroke: var(--ink-ghost); stroke-width: 2; stroke-dasharray: 3 4; stroke-linecap: round; }
    .x-mark .ink { stroke: var(--red); stroke-width: 6; animation-duration: .35s; }
    .x-mark path:nth-child(2) { animation-delay: .25s; }
    .flash { fill: #ffb703; stroke: #e85d04; stroke-width: 1.2; transform-origin: 92px 43px; animation: flash .5s ease-out both; }
    :host(.dead) .fig > g:not(.x-mark) { opacity: .28; filter: grayscale(1); }
    :host(.ready) .fig { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--ink) 45%, transparent)); }
    .ammo { display: flex; gap: 2px; margin-top: 1px; }
    .ammo i { width: 5px; height: 9px; border-radius: 3px 3px 1px 1px; border: 1.3px solid var(--ink); opacity: .45; }
    .ammo i.full { background: linear-gradient(#e9b949 0 45%, #b7791f 45%); border-color: #8a5a12; opacity: 1; }
    @keyframes pop-in { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes flash { 0% { transform: scale(.2); opacity: 0 } 30% { transform: scale(1.3); opacity: 1 } 100% { transform: scale(1); opacity: 0 } }
  `
})
export class SoldierComponent {
  readonly soldier = input.required<Soldier>();
  readonly color = input<string>('var(--p1)');
  readonly facing = input<'left' | 'right'>('right');
  /** Muzzle flash while shooting. */
  readonly flash = input(false);

  readonly gunStage = GUN_STAGE;
  readonly ammoSlots = Array.from({ length: FULL_AMMO });
  readonly isReady = computed(() => this.soldier().alive && this.soldier().stage === MAX_STAGE && this.soldier().bullets > 0);
  readonly ammo = computed(() => {
    const s = this.soldier();
    return s.stage === MAX_STAGE ? s.bullets : Math.max(0, s.stage - GUN_STAGE);
  });
}
