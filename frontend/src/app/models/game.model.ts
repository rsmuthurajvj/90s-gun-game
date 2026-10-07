// ── Soldier ──────────────────────────────────────────────────────────────────
// stage 0 = empty · 1 head · 2 body · 3 legs · 4 arms · 5 gun · 6‥11 bullets
// bullets = remaining ammo (0-6)
export interface Soldier {
  stage: number;
  bullets: number;
  alive: boolean;
}

export type SlotKey = 's0' | 's2' | 's4' | 's6' | 's8';
export type SoldierMap = Record<SlotKey, Soldier>;

export interface Player {
  name: string;
  soldiers: SoldierMap;
  score: number;
  connected?: boolean;
}

export interface Rules {
  /** quick: all 6 bullets on one roll after the gun. classic: one bullet per roll. */
  bulletMode: 'quick' | 'classic';
  hitChance: 50 | 100;
}

export interface LogEntry {
  message: string;
  playerIndex: number | null;
  timestamp: string | Date;
}

export type GameStatus = 'waiting' | 'coin_toss' | 'playing' | 'choosing_target' | 'finished';

export interface GameState {
  roomId: string;
  status: GameStatus;
  rules: Rules;
  players: Player[];
  currentTurn: number;
  lastRoll: number | null;
  pendingShooterSlot: SlotKey | null;
  winner: number;
  round: number;
  rematchVotes: boolean[];
  log: LogEntry[];
}

export type RollAction = 'GROW' | 'LOAD' | 'LOADED' | 'SHOOT' | 'RELOAD' | 'DEAD';

export interface RollOutcome {
  playerIndex: number;
  rolledNum: number;
  slot: SlotKey;
  action: RollAction;
}

export interface ShotOutcome {
  shooterIndex: number;
  shooterSlot: SlotKey;
  targetSlot: SlotKey;
  hit: boolean;
  gameOver: boolean;
}

export interface CoinOutcome {
  result: 'heads' | 'tails';
  choice: 'heads' | 'tails';
  winnerIndex: number;
}

export const SOLDIER_SLOTS: SlotKey[] = ['s0', 's2', 's4', 's6', 's8'];
export const SLOT_NUMBERS: Record<SlotKey, number> = { s0: 0, s2: 2, s4: 4, s6: 6, s8: 8 };
export const MAX_STAGE = 11;
export const GUN_STAGE = 5;
export const FULL_AMMO = 6;
export const DEFAULT_RULES: Rules = { bulletMode: 'quick', hitChance: 100 };

export const PART_LABELS: Record<number, string> = {
  1: 'Head', 2: 'Body', 3: 'Legs', 4: 'Arms', 5: 'Gun'
};

/** Short caption shown under the rolled number. */
export function describeRoll(action: RollAction, soldier: Soldier | undefined, num: number): string {
  switch (action) {
    case 'GROW': return `Soldier ${num} draws ${PART_LABELS[soldier?.stage ?? 1]?.toUpperCase() ?? 'A PART'}`;
    case 'LOAD': return `Soldier ${num} loads bullet ${soldier?.bullets ?? ''}`;
    case 'LOADED': return `Soldier ${num} is FULLY LOADED!`;
    case 'SHOOT': return `Soldier ${num} takes aim — SHOOT!`;
    case 'RELOAD': return `Soldier ${num} RELOADS 6 bullets`;
    case 'DEAD': return `Soldier ${num} is dead — turn lost`;
  }
}
