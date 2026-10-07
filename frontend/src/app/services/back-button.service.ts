import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

type Handler = () => void;

/**
 * Android hardware back button. The most recently registered handler wins
 * (an open dialog closes before the screen underneath reacts). With no
 * handler, the app exits — the home screen relies on that.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private handlers: Handler[] = [];

  constructor(zone: NgZone) {
    if (!Capacitor.isNativePlatform()) return;
    App.addListener('backButton', () => {
      zone.run(() => {
        const top = this.handlers[this.handlers.length - 1];
        if (top) top();
        else App.exitApp();
      });
    });
  }

  /** Registers a handler; call the returned function to remove it. */
  push(handler: Handler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}
