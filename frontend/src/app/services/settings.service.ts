import { Injectable, signal } from '@angular/core';
import { DEFAULT_RULES, Rules } from '../models/game.model';

interface Stats {
  cpuWins: number;
  cpuLosses: number;
  roundsPlayed: number;
}

interface StoredSettings {
  name: string;
  friendName: string;
  sound: boolean;
  vibration: boolean;
  rules: Rules;
  cpuEasy: boolean;
  seenTutorial: boolean;
  stats: Stats;
}

const KEY = 'ggg.settings';

const DEFAULTS: StoredSettings = {
  name: '',
  friendName: '',
  sound: true,
  vibration: true,
  rules: DEFAULT_RULES,
  cpuEasy: false,
  seenTutorial: false,
  stats: { cpuWins: 0, cpuLosses: 0, roundsPlayed: 0 }
};

/** Player preferences and stats, remembered on this device. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly value = signal<StoredSettings>(this.load());

  update(patch: Partial<StoredSettings>): void {
    this.value.update((v) => ({ ...v, ...patch }));
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value()));
    } catch { /* private mode etc. — settings just won't persist */ }
  }

  recordRound(mode: 'local' | 'cpu' | 'online', iWon: boolean | null): void {
    const s = { ...this.value().stats };
    s.roundsPlayed += 1;
    if (mode === 'cpu' && iWon !== null) iWon ? s.cpuWins++ : s.cpuLosses++;
    this.update({ stats: s });
  }

  private load(): StoredSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULTS;
      const saved = JSON.parse(raw);
      return { ...DEFAULTS, ...saved, stats: { ...DEFAULTS.stats, ...saved.stats }, rules: { ...DEFAULTS.rules, ...saved.rules } };
    } catch {
      return DEFAULTS;
    }
  }
}
