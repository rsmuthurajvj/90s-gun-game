// TypeScript twin of backend/src/game/engine.js — used for the offline modes
// (Pass & Play, vs Computer). Keep both files in sync when changing rules.

import {
  CoinOutcome, DEFAULT_RULES, FULL_AMMO, GameState, GUN_STAGE, MAX_STAGE, Player,
  RollAction, RollOutcome, Rules, ShotOutcome, SLOT_NUMBERS, SlotKey, SOLDIER_SLOTS, SoldierMap
} from '../models/game.model';

export type Rng = () => number;

const NUMBERS = [0, 2, 4, 6, 8];
const LOG_LIMIT = 60;
const PART_NAMES: Record<number, string> = { 1: 'a head', 2: 'a body', 3: 'legs', 4: 'arms', 5: 'a gun' };

export class GameError extends Error {}

export function freshSoldiers(): SoldierMap {
  const map = {} as SoldierMap;
  for (const s of SOLDIER_SLOTS) map[s] = { stage: 0, bullets: 0, alive: true };
  return map;
}

export function newLocalGame(names: [string, string], rules: Rules = DEFAULT_RULES): GameState {
  const players: Player[] = names.map((name) => ({ name, score: 0, connected: true, soldiers: freshSoldiers() }));
  return {
    roomId: 'LOCAL',
    status: 'coin_toss',
    rules: { ...rules },
    players,
    currentTurn: 0,
    lastRoll: null,
    pendingShooterSlot: null,
    winner: -1,
    round: 1,
    rematchVotes: [false, false],
    log: []
  };
}

const other = (i: number) => (i === 0 ? 1 : 0);

function log(state: GameState, message: string, playerIndex: number | null = null): void {
  state.log.push({ message, playerIndex, timestamp: new Date() });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

export function allDead(player: Player): boolean {
  return SOLDIER_SLOTS.every((s) => !player.soldiers[s].alive);
}

export function coinToss(state: GameState, callerIndex: number, choice: 'heads' | 'tails', rng: Rng = Math.random): CoinOutcome {
  if (state.status !== 'coin_toss') throw new GameError('Not time for the coin toss.');
  if (callerIndex !== 0) throw new GameError('Only the host calls the toss.');
  const result = rng() < 0.5 ? 'heads' : 'tails';
  const winnerIndex = choice === result ? 0 : 1;
  state.currentTurn = winnerIndex;
  state.status = 'playing';
  log(state, `Coin shows ${result.toUpperCase()} — ${state.players[winnerIndex].name} starts!`, winnerIndex);
  return { result, choice, winnerIndex };
}

export function roll(state: GameState, playerIndex: number, rng: Rng = Math.random): RollOutcome {
  if (state.status !== 'playing') throw new GameError('You cannot roll right now.');
  if (state.currentTurn !== playerIndex) throw new GameError('Not your turn.');

  const rolledNum = NUMBERS[Math.floor(rng() * NUMBERS.length)];
  const slot = `s${rolledNum}` as SlotKey;
  const player = state.players[playerIndex];
  const soldier = player.soldiers[slot];
  const who = player.name;
  let action: RollAction;

  state.lastRoll = rolledNum;

  if (!soldier.alive) {
    action = 'DEAD';
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} is dead. Turn lost.`, playerIndex);
  } else if (soldier.stage < GUN_STAGE) {
    soldier.stage += 1;
    action = 'GROW';
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} drew ${PART_NAMES[soldier.stage]}.`, playerIndex);
  } else if (soldier.stage < MAX_STAGE) {
    if (state.rules.bulletMode === 'quick') {
      soldier.stage = MAX_STAGE;
      soldier.bullets = FULL_AMMO;
    } else {
      soldier.stage += 1;
      soldier.bullets = soldier.stage - GUN_STAGE;
    }
    action = soldier.stage === MAX_STAGE ? 'LOADED' : 'LOAD';
    log(
      state,
      action === 'LOADED'
        ? `${who} got ${rolledNum} — soldier ${rolledNum} is fully loaded! 🔫`
        : `${who} got ${rolledNum} — soldier ${rolledNum} loaded bullet ${soldier.bullets}.`,
      playerIndex
    );
  } else if (soldier.bullets > 0) {
    action = 'SHOOT';
    state.status = 'choosing_target';
    state.pendingShooterSlot = slot;
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} takes aim!`, playerIndex);
  } else {
    soldier.bullets = FULL_AMMO;
    action = 'RELOAD';
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} reloaded 6 bullets.`, playerIndex);
  }

  if (action !== 'SHOOT') state.currentTurn = other(playerIndex);
  return { playerIndex, rolledNum, slot, action };
}

export function shoot(state: GameState, shooterIndex: number, targetSlot: SlotKey, rng: Rng = Math.random): ShotOutcome {
  if (state.status !== 'choosing_target') throw new GameError('No shot to take.');
  if (state.currentTurn !== shooterIndex) throw new GameError('Not your turn.');
  if (!SOLDIER_SLOTS.includes(targetSlot)) throw new GameError('Invalid target.');

  const enemyIndex = other(shooterIndex);
  const target = state.players[enemyIndex].soldiers[targetSlot];
  if (!target.alive) throw new GameError('That soldier is already dead.');

  const shooterSlot = state.pendingShooterSlot as SlotKey;
  const shooter = state.players[shooterIndex].soldiers[shooterSlot];
  if (!shooter?.alive || shooter.stage !== MAX_STAGE || shooter.bullets <= 0) throw new GameError('Shooter is not ready.');

  shooter.bullets -= 1;
  const hit = state.rules.hitChance >= 100 || rng() * 100 < state.rules.hitChance;
  const who = state.players[shooterIndex].name;
  const enemy = state.players[enemyIndex].name;
  const sNum = SLOT_NUMBERS[shooterSlot];
  const tNum = SLOT_NUMBERS[targetSlot];

  if (hit) {
    target.alive = false;
    log(state, `💥 ${who}'s soldier ${sNum} shot ${enemy}'s soldier ${tNum}!`, shooterIndex);
  } else {
    log(state, `💨 ${who}'s soldier ${sNum} missed ${enemy}'s soldier ${tNum}.`, shooterIndex);
  }

  state.pendingShooterSlot = null;
  let gameOver = false;
  if (hit && allDead(state.players[enemyIndex])) {
    gameOver = true;
    state.status = 'finished';
    state.winner = shooterIndex;
    state.players[shooterIndex].score += 1;
    log(state, `🏆 ${who} wins round ${state.round}!`, shooterIndex);
  } else {
    state.status = 'playing';
    state.currentTurn = enemyIndex;
  }
  return { shooterIndex, shooterSlot, targetSlot, hit, gameOver };
}

export function startRematch(state: GameState): void {
  if (state.status !== 'finished') throw new GameError('The round is not over yet.');
  const loser = other(state.winner);
  for (const p of state.players) p.soldiers = freshSoldiers();
  state.round += 1;
  state.status = 'playing';
  state.currentTurn = loser;
  state.winner = -1;
  state.lastRoll = null;
  state.pendingShooterSlot = null;
  state.rematchVotes = [false, false];
  log(state, `Round ${state.round} — ${state.players[loser].name} starts.`, loser);
}
