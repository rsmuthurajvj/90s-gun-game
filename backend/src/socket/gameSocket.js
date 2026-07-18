'use strict';

const { v4: uuidv4 } = require('uuid');
const Game = require('../models/Game');

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SLOTS = ['s0', 's2', 's4', 's6', 's8'];
const SLOT_NUMBERS = { s0: 0, s2: 2, s4: 4, s6: 6, s8: 8 };

const STAGE_NAMES = {
  1: 'Head', 2: 'Body', 3: 'Legs', 4: 'Arms', 5: 'Gun',
  6: 'Bullet 1', 7: 'Bullet 2', 8: 'Bullet 3',
  9: 'Bullet 4', 10: 'Bullet 5', 11: 'Bullet 6 (READY!)'
};

function slotKey(num) {
  return `s${num}`;
}

function numToSlot(n) {
  return `s${n}`;
}

function rollNumber() {
  const values = [0, 2, 4, 6, 8];
  return values[Math.floor(Math.random() * values.length)];
}

/** Serialise a game doc to a plain object safe to send to clients. */
function formatGame(game) {
  return {
    roomId: game.roomId,
    status: game.status,
    players: game.players.map((p) => ({
      name: p.name,
      soldiers: {
        s0: p.soldiers.s0.toObject ? p.soldiers.s0.toObject() : p.soldiers.s0,
        s2: p.soldiers.s2.toObject ? p.soldiers.s2.toObject() : p.soldiers.s2,
        s4: p.soldiers.s4.toObject ? p.soldiers.s4.toObject() : p.soldiers.s4,
        s6: p.soldiers.s6.toObject ? p.soldiers.s6.toObject() : p.soldiers.s6,
        s8: p.soldiers.s8.toObject ? p.soldiers.s8.toObject() : p.soldiers.s8
      }
    })),
    currentTurn: game.currentTurn,
    lastRoll: game.lastRoll,
    pendingShooterSlot: game.pendingShooterSlot,
    winner: game.winner,
    log: game.log.slice(-30).map((l) => ({
      message: l.message,
      playerIndex: l.playerIndex,
      timestamp: l.timestamp
    }))
  };
}

function allSoldiersDeadFor(game, playerIndex) {
  const soldiers = game.players[playerIndex].soldiers;
  return VALID_SLOTS.every((s) => !soldiers[s].alive);
}

// ── Socket initialiser ────────────────────────────────────────────────────────

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    // ── create_game ───────────────────────────────────────────────────────────
    socket.on('create_game', async ({ playerName }) => {
      try {
        if (!playerName || typeof playerName !== 'string') {
          return socket.emit('error', { message: 'Invalid player name.' });
        }
        const sanitised = playerName.trim().substring(0, 30);
        const roomId = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

        const game = new Game({
          roomId,
          players: [{ socketId: socket.id, name: sanitised }],
          status: 'waiting'
        });
        await game.save();

        socket.join(roomId);
        socket.emit('game_created', {
          roomId,
          playerIndex: 0,
          gameState: formatGame(game)
        });
      } catch (err) {
        console.error('[create_game]', err);
        socket.emit('error', { message: 'Could not create game.' });
      }
    });

    // ── join_game ─────────────────────────────────────────────────────────────
    socket.on('join_game', async ({ roomId, playerName }) => {
      try {
        if (!roomId || !playerName) {
          return socket.emit('error', { message: 'Room ID and name are required.' });
        }
        const sanitised = playerName.trim().substring(0, 30);
        const game = await Game.findOne({ roomId: roomId.toUpperCase().trim() });

        if (!game) return socket.emit('error', { message: 'Game not found.' });
        if (game.players.length >= 2) return socket.emit('error', { message: 'Game is full.' });
        if (game.status !== 'waiting') return socket.emit('error', { message: 'Game already started.' });

        game.players.push({ socketId: socket.id, name: sanitised });
        game.status = 'coin_toss';
        await game.save();

        socket.join(roomId);

        // Tell the joining player their index
        socket.emit('game_joined', {
          playerIndex: 1,
          gameState: formatGame(game)
        });

        // Tell player 1 someone joined
        socket.to(roomId).emit('opponent_joined', {
          opponentName: sanitised,
          gameState: formatGame(game)
        });
      } catch (err) {
        console.error('[join_game]', err);
        socket.emit('error', { message: 'Could not join game.' });
      }
    });

    // ── rejoin_game (reconnect) ────────────────────────────────────────────────
    socket.on('rejoin_game', async ({ roomId, playerIndex }) => {
      try {
        const game = await Game.findOne({ roomId });
        if (!game) return socket.emit('error', { message: 'Game not found.' });
        if (playerIndex !== 0 && playerIndex !== 1) return;
        if (!game.players[playerIndex]) return socket.emit('error', { message: 'Slot not found.' });

        game.players[playerIndex].socketId = socket.id;
        await game.save();

        socket.join(roomId);
        socket.emit('rejoined', { playerIndex, gameState: formatGame(game) });
      } catch (err) {
        console.error('[rejoin_game]', err);
        socket.emit('error', { message: 'Rejoin failed.' });
      }
    });

    // ── coin_toss ─────────────────────────────────────────────────────────────
    // Only player 1 (index 0) initiates the toss; player 2 just watches.
    socket.on('coin_toss', async ({ roomId, choice }) => {
      try {
        const game = await Game.findOne({ roomId });
        if (!game || game.status !== 'coin_toss') return;

        const playerIndex = game.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== 0) return; // Only player 1 chooses

        const validChoices = ['heads', 'tails'];
        if (!validChoices.includes(choice)) return;

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const winner = choice === result ? 0 : 1;

        game.currentTurn = winner;
        game.status = 'playing';
        game.log.push({
          message: `Coin landed on ${result}. ${game.players[winner].name} goes first!`,
          playerIndex: winner
        });
        await game.save();

        io.to(roomId).emit('coin_toss_result', {
          result,
          choice,
          winnerIndex: winner,
          winnerName: game.players[winner].name,
          gameState: formatGame(game)
        });
      } catch (err) {
        console.error('[coin_toss]', err);
        socket.emit('error', { message: 'Coin toss failed.' });
      }
    });

    // ── roll ──────────────────────────────────────────────────────────────────
    socket.on('roll', async ({ roomId }) => {
      try {
        const game = await Game.findOne({ roomId });
        if (!game || game.status !== 'playing') return;

        const playerIndex = game.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex !== game.currentTurn) {
          return socket.emit('error', { message: 'Not your turn.' });
        }

        const rolledNum = rollNumber();
        const slot = numToSlot(rolledNum);
        game.lastRoll = rolledNum;

        const soldier = game.players[playerIndex].soldiers[slot];
        let action = '';

        // ── Dead soldier: skip — turn passes to opponent ───────────────────────
        if (!soldier.alive) {
          action = 'DEAD';
          game.log.push({
            message: `${game.players[playerIndex].name} rolled ${rolledNum} → Soldier ${rolledNum} is dead. Turn skipped.`,
            playerIndex
          });
          game.currentTurn = playerIndex === 0 ? 1 : 0;
          await game.save();
          io.to(roomId).emit('roll_result', { rolledNum, action, gameState: formatGame(game) });
          return;
        }

        if (soldier.stage < 5) {
          // GROW phase: head → body → legs → arms → gun (stages 1-5)
          soldier.stage += 1;
          action = 'GROW';
          game.log.push({
            message: `${game.players[playerIndex].name} rolled ${rolledNum} → Soldier ${rolledNum} grew a ${STAGE_NAMES[soldier.stage]}`,
            playerIndex
          });
          game.currentTurn = playerIndex === 0 ? 1 : 0;
          await game.save();
          io.to(roomId).emit('roll_result', { rolledNum, action, gameState: formatGame(game) });

        } else if (soldier.stage === 5) {
          // Gun already present → load ALL 6 bullets at once on this single roll
          soldier.stage = 11;
          soldier.bullets = 6;
          action = 'LOADED';
          game.log.push({
            message: `${game.players[playerIndex].name} rolled ${rolledNum} → Soldier ${rolledNum} LOADED all 6 bullets instantly! 🔫`,
            playerIndex
          });
          game.currentTurn = playerIndex === 0 ? 1 : 0;
          await game.save();
          io.to(roomId).emit('roll_result', { rolledNum, action, gameState: formatGame(game) });

        } else if (soldier.bullets > 0) {
          // SHOOT phase – wait for target selection
          action = 'SHOOT';
          game.status = 'choosing_target';
          game.pendingShooterSlot = slot;
          await game.save();

          // Ask the current player to pick a target
          socket.emit('choose_target', { rolledNum, gameState: formatGame(game) });
          // Inform opponent they must wait
          socket.to(roomId).emit('opponent_choosing', { rolledNum, gameState: formatGame(game) });

        } else {
          // RELOAD phase
          action = 'RELOAD';
          soldier.bullets = 6;
          game.log.push({
            message: `${game.players[playerIndex].name} rolled ${rolledNum} → Soldier ${rolledNum} RELOADED (6 bullets)!`,
            playerIndex
          });
          game.currentTurn = playerIndex === 0 ? 1 : 0;
          await game.save();
          io.to(roomId).emit('roll_result', { rolledNum, action, gameState: formatGame(game) });
        }
      } catch (err) {
        console.error('[roll]', err);
        socket.emit('error', { message: 'Roll failed.' });
      }
    });

    // ── shoot ─────────────────────────────────────────────────────────────────
    socket.on('shoot', async ({ roomId, targetSlot }) => {
      try {
        const game = await Game.findOne({ roomId });
        if (!game || game.status !== 'choosing_target') return;

        const shooterIndex = game.players.findIndex((p) => p.socketId === socket.id);
        if (shooterIndex === -1 || shooterIndex !== game.currentTurn) return;

        if (!VALID_SLOTS.includes(targetSlot)) {
          return socket.emit('error', { message: 'Invalid target slot.' });
        }

        const enemyIndex = shooterIndex === 0 ? 1 : 0;
        const targetSoldier = game.players[enemyIndex].soldiers[targetSlot];

        if (!targetSoldier || !targetSoldier.alive) {
          return socket.emit('error', { message: 'Target is already dead or invalid.' });
        }

        // Consume one bullet
        const shooterSlot = game.pendingShooterSlot;
        game.players[shooterIndex].soldiers[shooterSlot].bullets -= 1;

        // Every shot always hits — no miss mechanic
        targetSoldier.alive = false;
        const slotNum = SLOT_NUMBERS[targetSlot];
        const logMsg = `💥 ${game.players[shooterIndex].name} SHOT and KILLED enemy Soldier ${slotNum}!`;
        const hit = true;

        game.log.push({ message: logMsg, playerIndex: shooterIndex });

        // Check win condition
        if (allSoldiersDeadFor(game, enemyIndex)) {
          game.status = 'finished';
          game.winner = shooterIndex;
          game.log.push({
            message: `🏆 ${game.players[shooterIndex].name} WINS THE GAME!`,
            playerIndex: shooterIndex
          });
        } else {
          game.status = 'playing';
          game.currentTurn = enemyIndex;
        }

        game.pendingShooterSlot = null;
        await game.save();

        io.to(roomId).emit('shoot_result', {
          hit,
          targetSlot,
          shooterSlot,
          shooterName: game.players[shooterIndex].name,
          gameState: formatGame(game)
        });

        if (game.status === 'finished') {
          io.to(roomId).emit('game_over', {
            winnerIndex: shooterIndex,
            winnerName: game.players[shooterIndex].name,
            gameState: formatGame(game)
          });
        }
      } catch (err) {
        console.error('[shoot]', err);
        socket.emit('error', { message: 'Shot failed.' });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
