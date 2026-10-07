import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="home-page">
      <div style="width:100%;max-width:440px;">

        <!-- Title -->
        <div style="text-align:center;margin-bottom:32px;">
          <!-- <div style="font-size:56px;line-height:1;">&#x1F52B;</div> -->
          <h1 style="font-size:32px;font-weight:900;letter-spacing:-1px;margin:8px 0 4px;">
            90s Gun Game
          </h1>
          <p style="color:#9ca3af;font-family:'Courier New',monospace;font-size:13px;margin:0;">
            The classic notebook shooting game &mdash; now digital
          </p>
        </div>

        <!-- Card -->
        <div class="card">

          <!-- Name field -->
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">
              Your Name
            </label>
            <input
              [(ngModel)]="playerName"
              maxlength="30"
              placeholder="Enter your name..."
              class="field-input"
              (keyup.enter)="createGame()"
            />
          </div>

          <!-- Create -->
          <button
            class="btn btn-orange"
            style="width:100%;padding:14px;font-size:16px;margin-bottom:20px;"
            (click)="createGame()"
            [disabled]="!playerName.trim() || loading"
          >
            {{ loading ? 'Loading...' : 'Create New Game' }}
          </button>

          <!-- Divider -->
          <div class="divider" style="margin-bottom:20px;">or join existing</div>

          <!-- Join -->
          <div style="display:flex;gap:10px;">
            <input
              [(ngModel)]="joinRoomId"
              placeholder="ROOM CODE"
              maxlength="8"
              class="field-input"
              style="text-transform:uppercase;letter-spacing:0.18em;font-size:15px;font-weight:700;"
              (keyup.enter)="joinGame()"
            />
            <button
              class="btn btn-blue"
              style="padding:10px 20px;flex-shrink:0;"
              (click)="joinGame()"
              [disabled]="!playerName.trim() || !joinRoomId.trim() || loading"
            >
              Join
            </button>
          </div>

          <!-- Error -->
          <div *ngIf="notification"
            style="margin-top:14px;padding:8px 12px;background:#fef2f2;border:1.5px solid #f87171;border-radius:8px;font-size:13px;color:#b91c1c;text-align:center;font-family:'Courier New',monospace;">
            {{ notification }}
          </div>
        </div>

        <!-- How to play hint -->
        <div style="text-align:center;margin-top:20px;font-size:12px;color:#9ca3af;font-family:'Courier New',monospace;line-height:1.7;">
          Roll 0/2/4/6/8 &rarr; grow soldiers &rarr; shoot enemies
        </div>

      </div>
    </div>
  `
})
export class HomeComponent implements OnInit, OnDestroy {
  playerName = '';
  joinRoomId = '';
  loading = false;
  notification = '';
  private sub!: Subscription;

  constructor(private gameService: GameService, private router: Router) {}

  ngOnInit(): void {
    this.sub = this.gameService.lastAction$.subscribe(({ type, data }) => {
      if (type === 'GAME_CREATED' || type === 'GAME_JOINED') {
        const state = (data as { gameState: { roomId: string } }).gameState;
        this.loading = false;
        this.router.navigate(['/game', state.roomId]);
      }
    });
    this.gameService.notification$.subscribe((msg) => {
      this.notification = msg;
      this.loading = false;
      setTimeout(() => (this.notification = ''), 4000);
    });
  }

  createGame(): void {
    if (!this.playerName.trim() || this.loading) return;
    this.loading = true;
    this.notification = '';
    this.gameService.createGame(this.playerName.trim());
  }

  joinGame(): void {
    if (!this.playerName.trim() || !this.joinRoomId.trim() || this.loading) return;
    this.loading = true;
    this.notification = '';
    this.gameService.joinGame(this.joinRoomId.trim(), this.playerName.trim());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}