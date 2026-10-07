import { Injectable } from '@angular/core';
import { Rules } from '../models/game.model';
import { GameSession, LocalSession, OnlineSeat, OnlineSession } from './session';
import { SocketService } from './socket.service';

/** Holds the game currently being played, whatever the mode. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  current: GameSession | null = null;

  constructor(private socket: SocketService) {}

  startLocal(names: [string, string], rules: Rules): GameSession {
    return this.set(new LocalSession('local', names, rules));
  }

  startCpu(name: string, rules: Rules, easy: boolean): GameSession {
    return this.set(new LocalSession('cpu', [name, 'Computer'], rules, easy));
  }

  async openOnline(request: Parameters<typeof OnlineSession.open>[1]): Promise<OnlineSession> {
    const session = await OnlineSession.open(this.socket, request);
    this.set(session);
    return session;
  }

  resumeOnline(seat: OnlineSeat): GameSession {
    return this.set(OnlineSession.resume(this.socket, seat));
  }

  end(): void {
    this.current?.leave();
    this.current = null;
  }

  private set<T extends GameSession>(session: T): T {
    this.end();
    this.current = session;
    return session;
  }
}
