import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SocketEvent {
  event: string;
  data: any;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  /** Every server event, plus a synthetic 'connect' on each (re)connection. */
  readonly events$ = new Subject<SocketEvent>();
  readonly status = signal<ConnectionStatus>('idle');

  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    this.status.set('connecting');
    this.socket = io(environment.serverUrl, {
      // WebSocket first; long-polling fallback for networks that block it.
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 4000,
      // Free-tier servers can take ~50 s to wake from sleep.
      timeout: 60000
    });

    this.socket.on('connect', () => {
      this.status.set('online');
      this.events$.next({ event: 'connect', data: null });
    });
    this.socket.on('disconnect', () => this.status.set('offline'));
    this.socket.on('connect_error', () => this.status.set('offline'));
    this.socket.onAny((event: string, data: unknown) => this.events$.next({ event, data }));
  }

  /** Wake a sleeping server early (fire-and-forget). */
  warmUp(): void {
    fetch(`${environment.serverUrl}/health`, { mode: 'cors' }).catch(() => undefined);
    this.connect();
  }

  emit(event: string, data: Record<string, unknown> = {}): void {
    if (!this.socket) this.connect();
    this.socket!.emit(event, data);
  }

  get connected(): boolean {
    return !!this.socket?.connected;
  }
}
