'use strict';

const crypto = require('crypto');
const Game = require('../models/Game');
const engine = require('../game/engine');

// Room codes avoid look-alike characters (0/O, 1/I/L) so they are easy to read out.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const NAME_MAX = 20;

function newRoomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().substring(0, NAME_MAX);
}

function cleanRoomId(roomId) {
  return typeof roomId === 'string' ? roomId.toUpperCase().trim() : '';
}

/** Public view of a game: never includes socket ids or reconnect tokens. */
function formatGame(game) {
  return {
    roomId: game.roomId,
    status: game.status,
    rules: engine.normaliseRules(game.rules),
    players: game.players.map((p) => ({
      name: p.name,
      connected: p.connected,
      score: p.score || 0,
      soldiers: engine.SLOTS.reduce((acc, s) => {
        const { stage, bullets, alive } = p.soldiers[s];
        acc[s] = { stage, bullets, alive };
        return acc;
      }, {})
    })),
    currentTurn: game.currentTurn,
    lastRoll: game.lastRoll,
    pendingShooterSlot: game.pendingShooterSlot,
    winner: game.winner,
    round: game.round || 1,
    rematchVotes: [...(game.rematchVotes || [false, false])],
    log: game.log.slice(-30).map((l) => ({
      message: l.message,
      playerIndex: l.playerIndex,
      timestamp: l.timestamp
    }))
  };
}

// ── Per-room serial queue ────────────────────────────────────────────────────
// Every mutation is load → change → save. Without serialising, two quick
// events for the same room (double tap, both players acting) could read the
// same document and overwrite each other.
const roomQueues = new Map();

function withRoom(roomId, task) {
  const prev = roomQueues.get(roomId) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  roomQueues.set(roomId, next);
  next.finally(() => {
    if (roomQueues.get(roomId) === next) roomQueues.delete(roomId);
  }).catch(() => {});
  return next;
}

function initSocket(io) {
  io.on('connection', (socket) => {
    const fail = (message) => socket.emit('game_error', { message });

    /**
     * Wraps a handler that acts on an existing room as the calling player.
     * Resolves the player's seat from the socket, serialises per room and
     * reports engine errors back to the caller.
     */
    const onRoom = (event, handler) => {
      socket.on(event, (payload = {}) => {
        const roomId = cleanRoomId(payload.roomId);
        if (!roomId) return fail('Missing room code.');
        withRoom(roomId, async () => {
          const game = await Game.findOne({ roomId });
          if (!game) return fail('Game not found. It may have expired.');
          const playerIndex = game.players.findIndex((p) => p.socketId === socket.id);
          if (playerIndex === -1) return fail('You are not in this game. Try reopening it.');
          await handler(game, playerIndex, payload);
        }).catch((err) => {
          if (err instanceof engine.GameError) return fail(err.message);
          console.error(`[${event}]`, err);
          fail('Something went wrong. Please try again.');
        });
      });
    };

    const remember = (roomId, playerIndex) => {
      socket.data.roomId = roomId;
      socket.data.playerIndex = playerIndex;
    };

    // ── create_game ───────────────────────────────────────────────────────────
    socket.on('create_game', async ({ playerName, rules } = {}) => {
      try {
        const name = cleanName(playerName);
        if (!name) return fail('Please enter your name.');

        let roomId = newRoomCode();
        while (await Game.exists({ roomId })) roomId = newRoomCode();

        const token = crypto.randomUUID();
        const game = new Game({
          roomId,
          rules: engine.normaliseRules(rules),
          players: [{ socketId: socket.id, token, name }],
          status: 'waiting'
        });
        game.log.push({ message: `${name} created the room.`, playerIndex: 0 });
        await game.save();

        socket.join(roomId);
        remember(roomId, 0);
        socket.emit('game_created', { playerIndex: 0, token, gameState: formatGame(game) });
      } catch (err) {
        console.error('[create_game]', err);
        fail('Could not create a game. Please try again.');
      }
    });

    // ── join_game ─────────────────────────────────────────────────────────────
    socket.on('join_game', ({ roomId: rawRoom, playerName } = {}) => {
      const roomId = cleanRoomId(rawRoom);
      const name = cleanName(playerName);
      if (!roomId || !name) return fail('Room code and name are required.');

      withRoom(roomId, async () => {
        const game = await Game.findOne({ roomId });
        if (!game) return fail('No game with that code.');
        if (game.players.length >= 2) return fail('That game is already full.');

        const token = crypto.randomUUID();
        game.players.push({ socketId: socket.id, token, name });
        game.status = 'coin_toss';
        game.log.push({ message: `${name} joined. Time for the coin toss!`, playerIndex: 1 });
        await game.save();

        socket.join(roomId);
        remember(roomId, 1);
        socket.emit('game_joined', { playerIndex: 1, token, gameState: formatGame(game) });
        socket.to(roomId).emit('state', { reason: 'opponent_joined', gameState: formatGame(game) });
      }).catch((err) => {
        console.error('[join_game]', err);
        fail('Could not join the game.');
      });
    });

    // ── rejoin_game: after refresh, app restart or network drop ──────────────
    socket.on('rejoin_game', ({ roomId: rawRoom, token } = {}) => {
      const roomId = cleanRoomId(rawRoom);
      if (!roomId || typeof token !== 'string') return fail('Cannot reconnect to that game.');

      withRoom(roomId, async () => {
        const game = await Game.findOne({ roomId });
        if (!game) return socket.emit('rejoin_failed', { message: 'That game has expired.' });
        const playerIndex = game.players.findIndex((p) => p.token === token);
        if (playerIndex === -1) return socket.emit('rejoin_failed', { message: 'You are not part of that game.' });

        game.players[playerIndex].socketId = socket.id;
        game.players[playerIndex].connected = true;
        await game.save();

        socket.join(roomId);
        remember(roomId, playerIndex);
        socket.emit('rejoined', { playerIndex, gameState: formatGame(game) });
        socket.to(roomId).emit('state', { reason: 'opponent_back', gameState: formatGame(game) });
      }).catch((err) => {
        console.error('[rejoin_game]', err);
        fail('Reconnect failed.');
      });
    });

    // ── coin_toss ─────────────────────────────────────────────────────────────
    onRoom('coin_toss', async (game, playerIndex, { choice }) => {
      const outcome = engine.coinToss(game, playerIndex, choice);
      await game.save();
      io.to(game.roomId).emit('coin_result', { ...outcome, gameState: formatGame(game) });
    });

    // ── roll ──────────────────────────────────────────────────────────────────
    // Result goes to both players at once; each client plays the book-flip
    // animation and only then reveals the new board.
    onRoom('roll', async (game, playerIndex) => {
      const outcome = engine.roll(game, playerIndex);
      await game.save();
      io.to(game.roomId).emit('roll_result', { ...outcome, gameState: formatGame(game) });
    });

    // ── shoot ─────────────────────────────────────────────────────────────────
    onRoom('shoot', async (game, playerIndex, { targetSlot }) => {
      const outcome = engine.shoot(game, playerIndex, targetSlot);
      await game.save();
      io.to(game.roomId).emit('shot_result', { ...outcome, gameState: formatGame(game) });
    });

    // ── rematch: both players must ask ───────────────────────────────────────
    onRoom('rematch', async (game, playerIndex) => {
      if (game.status !== 'finished') throw new engine.GameError('The round is not over yet.');
      const votes = [...(game.rematchVotes || [false, false])];
      votes[playerIndex] = true;
      game.rematchVotes = votes;

      if (votes[0] && votes[1]) {
        engine.startRematch(game);
        await game.save();
        io.to(game.roomId).emit('rematch_started', { gameState: formatGame(game) });
      } else {
        await game.save();
        io.to(game.roomId).emit('state', { reason: 'rematch_vote', gameState: formatGame(game) });
      }
    });

    // ── leave_game: player closed the game on purpose ────────────────────────
    onRoom('leave_game', async (game, playerIndex) => {
      game.players[playerIndex].connected = false;
      game.players[playerIndex].socketId = '';
      await game.save();
      socket.leave(game.roomId);
      socket.data.roomId = undefined;
      socket.to(game.roomId).emit('state', { reason: 'opponent_left', gameState: formatGame(game) });
    });

    // ── disconnect: tell the opponent, keep the seat for reconnect ───────────
    socket.on('disconnect', () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      withRoom(roomId, async () => {
        const game = await Game.findOne({ roomId });
        if (!game) return;
        const player = game.players.find((p) => p.socketId === socket.id);
        if (!player) return; // already reconnected on a new socket
        player.connected = false;
        await game.save();
        io.to(roomId).emit('state', { reason: 'opponent_offline', gameState: formatGame(game) });
      }).catch((err) => console.error('[disconnect]', err));
    });
  });
}

module.exports = { initSocket, formatGame };
