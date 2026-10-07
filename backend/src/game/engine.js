'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Pure game rules. Works on plain objects and on Mongoose documents alike
// (only property access and array push are used on the state).
//
// The frontend has a TypeScript twin of this file at
// frontend/src/app/game/engine.ts (used for offline Pass & Play / vs CPU).
// Keep both in sync when changing rules.
//
// Soldier stage:  0 empty · 1 head · 2 body · 3 legs · 4 arms · 5 gun
//                 6‥11 bullets loaded one by one (classic mode)
// Quick mode loads all 6 bullets on the first roll after the gun (5 → 11).
// At stage 11 a roll SHOOTS while bullets > 0, otherwise RELOADS to 6.
// ─────────────────────────────────────────────────────────────────────────────

const SLOTS = ['s0', 's2', 's4', 's6', 's8'];
const NUMBERS = [0, 2, 4, 6, 8];
const GUN_STAGE = 5;
const MAX_STAGE = 11;
const FULL_AMMO = 6;
const LOG_LIMIT = 60;
const PART_NAMES = { 1: 'a head', 2: 'a body', 3: 'legs', 4: 'arms', 5: 'a gun' };

const DEFAULT_RULES = Object.freeze({ bulletMode: 'quick', hitChance: 100 });

class GameError extends Error {}

function normaliseRules(rules) {
  const r = rules || {};
  return {
    bulletMode: r.bulletMode === 'classic' ? 'classic' : 'quick',
    hitChance: r.hitChance === 50 ? 50 : 100
  };
}

function freshSoldiers() {
  const soldiers = {};
  for (const s of SLOTS) soldiers[s] = { stage: 0, bullets: 0, alive: true };
  return soldiers;
}

function other(index) {
  return index === 0 ? 1 : 0;
}

function slotNumber(slot) {
  return Number(slot.slice(1));
}

function log(state, message, playerIndex = null) {
  state.log.push({ message, playerIndex, timestamp: new Date() });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function isReady(soldier) {
  return soldier.alive && soldier.stage === MAX_STAGE;
}

function allDead(player) {
  return SLOTS.every((s) => !player.soldiers[s].alive);
}

// ── Coin toss ────────────────────────────────────────────────────────────────

function coinToss(state, callerIndex, choice, rng = Math.random) {
  if (state.status !== 'coin_toss') throw new GameError('Not time for the coin toss.');
  if (callerIndex !== 0) throw new GameError('Only the host calls the toss.');
  if (choice !== 'heads' && choice !== 'tails') throw new GameError('Pick heads or tails.');

  const result = rng() < 0.5 ? 'heads' : 'tails';
  const winnerIndex = choice === result ? 0 : 1;
  state.currentTurn = winnerIndex;
  state.status = 'playing';
  log(state, `Coin shows ${result.toUpperCase()} — ${state.players[winnerIndex].name} starts!`, winnerIndex);
  return { result, choice, winnerIndex };
}

// ── Roll (open the book) ────────────────────────────────────────────────────

function roll(state, playerIndex, rng = Math.random) {
  if (state.status !== 'playing') throw new GameError('You cannot roll right now.');
  if (state.currentTurn !== playerIndex) throw new GameError('Not your turn.');

  const rolledNum = NUMBERS[Math.floor(rng() * NUMBERS.length)];
  const slot = `s${rolledNum}`;
  const player = state.players[playerIndex];
  const soldier = player.soldiers[slot];
  const rules = normaliseRules(state.rules);
  const who = player.name;
  let action;

  state.lastRoll = rolledNum;

  if (!soldier.alive) {
    action = 'DEAD';
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} is dead. Turn lost.`, playerIndex);
  } else if (soldier.stage < GUN_STAGE) {
    soldier.stage += 1;
    action = 'GROW';
    log(state, `${who} got ${rolledNum} — soldier ${rolledNum} drew ${PART_NAMES[soldier.stage]}.`, playerIndex);
  } else if (soldier.stage < MAX_STAGE) {
    if (rules.bulletMode === 'quick') {
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

// ── Shoot ────────────────────────────────────────────────────────────────────

function shoot(state, shooterIndex, targetSlot, rng = Math.random) {
  if (state.status !== 'choosing_target') throw new GameError('No shot to take.');
  if (state.currentTurn !== shooterIndex) throw new GameError('Not your turn.');
  if (!SLOTS.includes(targetSlot)) throw new GameError('Invalid target.');

  const enemyIndex = other(shooterIndex);
  const target = state.players[enemyIndex].soldiers[targetSlot];
  if (!target.alive) throw new GameError('That soldier is already dead.');

  const shooterSlot = state.pendingShooterSlot;
  const shooter = state.players[shooterIndex].soldiers[shooterSlot];
  if (!isReady(shooter) || shooter.bullets <= 0) throw new GameError('Shooter is not ready.');

  shooter.bullets -= 1;
  const rules = normaliseRules(state.rules);
  const hit = rules.hitChance >= 100 || rng() * 100 < rules.hitChance;
  const who = state.players[shooterIndex].name;
  const enemy = state.players[enemyIndex].name;

  if (hit) {
    target.alive = false;
    log(state, `💥 ${who}'s soldier ${slotNumber(shooterSlot)} shot ${enemy}'s soldier ${slotNumber(targetSlot)}!`, shooterIndex);
  } else {
    log(state, `💨 ${who}'s soldier ${slotNumber(shooterSlot)} missed ${enemy}'s soldier ${slotNumber(targetSlot)}.`, shooterIndex);
  }

  state.pendingShooterSlot = null;
  let gameOver = false;
  if (hit && allDead(state.players[enemyIndex])) {
    gameOver = true;
    state.status = 'finished';
    state.winner = shooterIndex;
    state.players[shooterIndex].score = (state.players[shooterIndex].score || 0) + 1;
    log(state, `🏆 ${who} wins round ${state.round || 1}!`, shooterIndex);
  } else {
    state.status = 'playing';
    state.currentTurn = enemyIndex;
  }

  return { shooterIndex, shooterSlot, targetSlot, hit, gameOver };
}

// ── Rematch: same players, scores kept, loser of last round starts ──────────

function startRematch(state) {
  if (state.status !== 'finished') throw new GameError('The round is not over yet.');
  const loser = other(state.winner);
  for (const p of state.players) p.soldiers = freshSoldiers();
  state.round = (state.round || 1) + 1;
  state.status = 'playing';
  state.currentTurn = loser;
  state.winner = -1;
  state.lastRoll = null;
  state.pendingShooterSlot = null;
  state.rematchVotes = [false, false];
  log(state, `Round ${state.round} — ${state.players[loser].name} starts.`, loser);
}

module.exports = {
  SLOTS,
  NUMBERS,
  MAX_STAGE,
  FULL_AMMO,
  DEFAULT_RULES,
  GameError,
  normaliseRules,
  freshSoldiers,
  coinToss,
  roll,
  shoot,
  startRematch
};
