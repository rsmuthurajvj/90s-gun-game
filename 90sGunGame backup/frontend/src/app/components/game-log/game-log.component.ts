import { Component, Input, ChangeDetectionStrategy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogEntry } from '../../models/game.model';

@Component({
  selector: 'app-game-log',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="log-wrap">
      <div class="log-header">📜 Game Log</div>
      <ul #list class="log-list" style="list-style:none;margin:0;padding:0;">
        <li
          *ngFor="let e of logs; trackBy: trackBy"
          class="log-item"
          [class.p0]="e.playerIndex === 0"
          [class.p1]="e.playerIndex === 1"
          [class.sys]="e.playerIndex == null"
        >{{ e.message }}</li>
        <li *ngIf="!logs?.length" class="log-item sys">No events yet…</li>
      </ul>
    </div>
  `
})
export class GameLogComponent implements AfterViewChecked {
  @Input() logs: LogEntry[] | null = [];
  @ViewChild('list') private listEl!: ElementRef<HTMLUListElement>;

  ngAfterViewChecked(): void {
    if (this.listEl) {
      const el = this.listEl.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  trackBy(index: number): number { return index; }
}