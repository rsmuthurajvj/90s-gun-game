// ── Soldier ──────────────────────────────────────────────────────────────────
// stage  0 = empty, 1=head, 2=body, 3=legs, 4=arms, 5=gun, 6-11=bullets 1-6
// bullets = remaining ammo (0-6), set to 6 when stage reaches 11 or on reload
export interface Soldier {
  stage: number;
  bullets: number;
  alive: boolean;
}

// ── Player ────────────────────────────────────────────────────────────────────
export interface SoldierMap {
  s0: Soldier;
  s2: Soldier;
  s4: Soldier;
  s6: Soldier;
  s8: Soldier;
}

export interface Player {
  name: string;
  soldiers: SoldierMap;
}

// ── Log entry ─────────────────────────────────────────────────────────────────
export interface LogEntry {
  message: string;
  playerIndex: number;
  timestamp: string;
}

// ── Game state ────────────────────────────────────────────────────────────────
export type GameStatus =
  | 'waiting'
  | 'coin_toss'
  | 'playing'
  | 'choosing_target'
  | 'finished';

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Player[];
  currentTurn: number;       // 0 or 1
  lastRoll: number | null;
  pendingShooterSlot: string | null;
  winner: number;            // -1 = no winner yet
  log: LogEntry[];
}

// ── Slot helpers ──────────────────────────────────────────────────────────────
export const SOLDIER_SLOTS: Array<keyof SoldierMap> = ['s0', 's2', 's4', 's6', 's8'];
export const SLOT_NUMBERS: Record<keyof SoldierMap, number> = {
  s0: 0, s2: 2, s4: 4, s6: 6, s8: 8
};

export function numToSlot(n: number): keyof SoldierMap {
  return `s${n}` as keyof SoldierMap;
}
