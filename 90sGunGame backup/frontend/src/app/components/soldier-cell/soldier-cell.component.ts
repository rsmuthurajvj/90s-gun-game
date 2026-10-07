import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Soldier } from '../../models/game.model';

interface Dot { filled: boolean; }

@Component({
  selector: 'app-soldier-cell',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"
      [class.targetable-cell]="isTargetable"
      (click)="onClick()"
    >
      <svg
        width="76" height="96"
        viewBox="0 0 76 96"
        [style.transform]="facing === 'left' ? 'scaleX(-1)' : 'none'"
        style="overflow:visible;"
        [attr.aria-label]="'Soldier ' + slotNumber"
      >
        <circle *ngIf="soldier.stage >= 1"
          cx="38" cy="13" r="11"
          fill="none" [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
        <line *ngIf="soldier.stage >= 2"
          x1="38" y1="24" x2="38" y2="62"
          [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
        <ng-container *ngIf="soldier.stage >= 3">
          <line x1="38" y1="62" x2="26" y2="86" [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="38" y1="62" x2="50" y2="86" [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
        </ng-container>
        <ng-container *ngIf="soldier.stage >= 4">
          <line x1="38" y1="42" x2="22" y2="53" [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="38" y1="42" x2="56" y2="51" [attr.stroke]="sc" stroke-width="2.5" stroke-linecap="round"/>
        </ng-container>
        <ng-container *ngIf="soldier.stage >= 5">
          <rect x="56" y="47" width="18" height="5" rx="1" [attr.fill]="sc"/>
          <rect x="60" y="52" width="6" height="8" rx="1" [attr.fill]="sc"/>
        </ng-container>
        <!-- Bullets shown only at stage 11 (all 6 loaded at once); dots = remaining ammo -->
        <ng-container *ngIf="soldier.stage === 11">
          <ng-container *ngFor="let dot of bulletDots; let i = index">
            <circle
              [attr.cx]="58 + i * 2.8" cy="45.5" r="1.6"
              [attr.fill]="dot.filled ? '#92400e' : 'transparent'"
              [attr.stroke]="'#92400e'" stroke-width="1.2"/>
          </ng-container>
        </ng-container>
        <ng-container *ngIf="!soldier.alive">
          <line x1="6" y1="4" x2="70" y2="92" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/>
          <line x1="70" y1="4" x2="6" y2="92" stroke="#dc2626" stroke-width="3.5" stroke-linecap="round"/>
        </ng-container>
      </svg>
    </div>
  `
})
export class SoldierCellComponent {
  @Input({ required: true }) soldier!: Soldier;
  @Input({ required: true }) slotKey!: string;
  @Input() slotNumber = 0;
  @Input() isTargetable = false;
  @Input() facing: 'right' | 'left' = 'right';
  @Output() targetSelected = new EventEmitter<string>();

  get sc(): string { return this.soldier.alive ? '#f97316' : '#d1d5db'; }

  get bulletDots(): Dot[] {
    const s = this.soldier;
    // Only at stage 11 (fully loaded): show remaining ammo as filled/empty dots
    if (s.stage !== 11) return [];
    return Array.from({ length: 6 }, (_, i) => ({ filled: i < s.bullets }));
  }

  onClick(): void {
    if (this.isTargetable && this.soldier.alive) this.targetSelected.emit(this.slotKey);
  }
}
