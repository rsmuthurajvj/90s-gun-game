'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../src/game/engine');

/** rng that makes roll() return the given number (0/2/4/6/8). */
const rollOf = (n) => () => engine.NUMBERS.indexOf(n) / engine.NUMBERS.length + 0.01;

function newGame(rules) {
  return {
    status: 'playing',
    rules: engine.normaliseRules(rules),
    players: [
      { name: 'A', score: 0, soldiers: engine.freshSoldiers() },
      { name: 'B', score: 0, soldiers: engine.freshSoldiers() }
    ],
    currentTurn: 0,
    lastRoll: null,
    pendingShooterSlot: null,
    winner: -1,
    round: 1,
    rematchVotes: [false, false],
    log: []
  };
}

/** Roll `n` for whoever's turn it is, then give the turn back to `player`. */
function rollFor(g, player, n) {
  g.currentTurn = player;
  return engine.roll(g, player, rollOf(n));
}

test('soldier grows head → gun, then quick mode loads all 6 bullets', () => {
  const g = newGame();
  const actions = [];
  for (let i = 0; i < 6; i++) actions.push(rollFor(g, 0, 2).action);
  assert.deepEqual(actions, ['GROW', 'GROW', 'GROW', 'GROW', 'GROW', 'LOADED']);
  assert.equal(g.players[0].soldiers.s2.stage, 11);
  assert.equal(g.players[0].soldiers.s2.bullets, 6);
});

test('classic mode loads one bullet per roll', () => {
  const g = newGame({ bulletMode: 'classic' });
  for (let i = 0; i < 5; i++) rollFor(g, 0, 4);
  const loads = [];
  for (let i = 0; i < 6; i++) loads.push(rollFor(g, 0, 4).action);
  assert.deepEqual(loads, ['LOAD', 'LOAD', 'LOAD', 'LOAD', 'LOAD', 'LOADED']);
  assert.equal(g.players[0].soldiers.s4.bullets, 6);
});

test('turn passes after a roll unless the soldier shoots', () => {
  const g = newGame();
  engine.roll(g, 0, rollOf(0));
  assert.equal(g.currentTurn, 1);
  assert.throws(() => engine.roll(g, 0, rollOf(0)), /Not your turn/);
});

test('loaded soldier shoots, kills, and empty gun reloads', () => {
  const g = newGame();
  for (let i = 0; i < 6; i++) rollFor(g, 0, 8);
  const r = rollFor(g, 0, 8);
  assert.equal(r.action, 'SHOOT');
  assert.equal(g.status, 'choosing_target');
  assert.equal(g.currentTurn, 0);

  const shot = engine.shoot(g, 0, 's6');
  assert.equal(shot.hit, true);
  assert.equal(g.players[1].soldiers.s6.alive, false);
  assert.equal(g.players[0].soldiers.s8.bullets, 5);
  assert.equal(g.currentTurn, 1);
  assert.throws(() => engine.shoot(g, 0, 's6'), /No shot/);

  g.players[0].soldiers.s8.bullets = 0;
  assert.equal(rollFor(g, 0, 8).action, 'RELOAD');
  assert.equal(g.players[0].soldiers.s8.bullets, 6);
});

test('cannot shoot a dead soldier; dead soldier loses the turn', () => {
  const g = newGame();
  g.players[0].soldiers.s0 = { stage: 11, bullets: 6, alive: true };
  g.players[1].soldiers.s2.alive = false;
  rollFor(g, 0, 0);
  assert.throws(() => engine.shoot(g, 0, 's2'), /already dead/);

  g.status = 'playing';
  g.pendingShooterSlot = null;
  g.players[0].soldiers.s4.alive = false;
  assert.equal(rollFor(g, 0, 4).action, 'DEAD');
  assert.equal(g.currentTurn, 1);
});

test('killing the last soldier wins, scores, and rematch resets with loser first', () => {
  const g = newGame();
  g.players[0].soldiers.s0 = { stage: 11, bullets: 6, alive: true };
  for (const s of ['s0', 's2', 's4', 's6']) g.players[1].soldiers[s].alive = false;
  rollFor(g, 0, 0);
  const shot = engine.shoot(g, 0, 's8');
  assert.equal(shot.gameOver, true);
  assert.equal(g.status, 'finished');
  assert.equal(g.winner, 0);
  assert.equal(g.players[0].score, 1);

  engine.startRematch(g);
  assert.equal(g.status, 'playing');
  assert.equal(g.round, 2);
  assert.equal(g.currentTurn, 1);
  assert.equal(g.players[1].soldiers.s8.alive, true);
  assert.equal(g.players[0].score, 1);
});

test('50% hit chance can miss and still uses a bullet', () => {
  const g = newGame({ hitChance: 50 });
  g.players[0].soldiers.s0 = { stage: 11, bullets: 6, alive: true };
  rollFor(g, 0, 0);
  const shot = engine.shoot(g, 0, 's2', () => 0.9);
  assert.equal(shot.hit, false);
  assert.equal(g.players[1].soldiers.s2.alive, true);
  assert.equal(g.players[0].soldiers.s0.bullets, 5);
});

test('coin toss: only host calls, winner starts', () => {
  const g = newGame();
  g.status = 'coin_toss';
  assert.throws(() => engine.coinToss(g, 1, 'heads'), /host/);
  const r = engine.coinToss(g, 0, 'tails', () => 0.1); // 0.1 → heads
  assert.equal(r.result, 'heads');
  assert.equal(r.winnerIndex, 1);
  assert.equal(g.currentTurn, 1);
  assert.equal(g.status, 'playing');
});
