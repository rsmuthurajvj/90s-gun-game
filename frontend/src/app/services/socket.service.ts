import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

export interface SocketEvent {
  event: string;
  data: unknown;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket!: Socket;
  private readonly serverUrl = 'https://nine0s-gun-game.onrender.com'; // 'http://localhost:3000';

  /** All incoming socket events are pushed here */
  readonly events$ = new Subject<SocketEvent>();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    const forward = (event: string) =>
      this.socket.on(event, (data: unknown) => this.events$.next({ event, data }));

    [
      'game_created',
      'game_joined',
      'rejoined',
      'opponent_joined',
      'coin_toss_result',
      'roll_result',
      'choose_target',
      'opponent_choosing',
      'shoot_result',
      'game_over',
      'error'
    ].forEach(forward);
  }

  emit(event: string, data: Record<string, unknown> = {}): void {
    if (!this.socket) this.connect();
    this.socket.emit(event, data);
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
