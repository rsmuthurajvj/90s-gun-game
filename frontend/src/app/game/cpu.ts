import { GameState, MAX_STAGE, SlotKey, SOLDIER_SLOTS, Soldier } from '../models/game.model';

/**
 * How dangerous an enemy soldier is: a loaded gun is the biggest threat,
 * then anything with a gun, then the most-drawn soldier.
 */
function threat(s: Soldier): number {
  if (!s.alive) return -1;
  if (s.stage === MAX_STAGE) return 100 + s.bullets;
  return s.stage * 10;
}

/** CPU target choice. `easy` sometimes picks a random living soldier. */
export function chooseCpuTarget(state: GameState, cpuIndex: number, easy = false): SlotKey {
  const enemy = state.players[cpuIndex === 0 ? 1 : 0];
  const alive = SOLDIER_SLOTS.filter((s) => enemy.soldiers[s].alive);
  if (easy && Math.random() < 0.5) return alive[Math.floor(Math.random() * alive.length)];

  let best = alive[0];
  for (const s of alive) {
    if (threat(enemy.soldiers[s]) > threat(enemy.soldiers[best])) best = s;
  }
  // Break ties randomly so the CPU doesn't always aim at soldier 0.
  const top = alive.filter((s) => threat(enemy.soldiers[s]) === threat(enemy.soldiers[best]));
  return top[Math.floor(Math.random() * top.length)];
}
