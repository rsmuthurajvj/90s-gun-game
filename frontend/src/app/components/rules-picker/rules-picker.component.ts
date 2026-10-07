import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { Rules } from '../../models/game.model';

@Component({
  selector: 'app-rules-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field-label">Bullets</div>
    <div class="seg" role="radiogroup" aria-label="Bullets">
      <button role="radio" [attr.aria-checked]="rules().bulletMode === 'quick'" [class.on]="rules().bulletMode === 'quick'"
              (click)="set({ bulletMode: 'quick' })">All 6 at once<small>faster game</small></button>
      <button role="radio" [attr.aria-checked]="rules().bulletMode === 'classic'" [class.on]="rules().bulletMode === 'classic'"
              (click)="set({ bulletMode: 'classic' })">One by one<small>classic notebook</small></button>
    </div>
    <div class="field-label">Shots</div>
    <div class="seg" role="radiogroup" aria-label="Shots">
      <button role="radio" [attr.aria-checked]="rules().hitChance === 100" [class.on]="rules().hitChance === 100"
              (click)="set({ hitChance: 100 })">Always hit<small>every shot kills</small></button>
      <button role="radio" [attr.aria-checked]="rules().hitChance === 50" [class.on]="rules().hitChance === 50"
              (click)="set({ hitChance: 50 })">50 / 50<small>shots can miss</small></button>
    </div>
  `
})
export class RulesPickerComponent {
  readonly rules = model.required<Rules>();

  set(patch: Partial<Rules>): void {
    this.rules.update((r) => ({ ...r, ...patch }));
  }
}
