'use strict';

const mongoose = require('mongoose');

// See src/game/engine.js for what stage / bullets mean.

const soldierSchema = new mongoose.Schema(
  {
    stage: { type: Number, default: 0, min: 0, max: 11 },
    bullets: { type: Number, default: 0, min: 0, max: 6 },
    alive: { type: Boolean, default: true }
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    socketId: { type: String, default: '' },
    // Secret handed only to this player; required to reconnect to the seat.
    token: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 20 },
    connected: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
    soldiers: {
      s0: { type: soldierSchema, default: () => ({}) },
      s2: { type: soldierSchema, default: () => ({}) },
      s4: { type: soldierSchema, default: () => ({}) },
      s6: { type: soldierSchema, default: () => ({}) },
      s8: { type: soldierSchema, default: () => ({}) }
    }
  },
  { _id: false }
);

const logEntrySchema = new mongoose.Schema(
  {
    message: { type: String },
    playerIndex: { type: Number, default: null },
    timestamp: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, required: true, index: true },
    status: {
      type: String,
      enum: ['waiting', 'coin_toss', 'playing', 'choosing_target', 'finished'],
      default: 'waiting'
    },
    rules: {
      bulletMode: { type: String, enum: ['quick', 'classic'], default: 'quick' },
      hitChance: { type: Number, enum: [50, 100], default: 100 }
    },
    players: { type: [playerSchema], default: [] },
    currentTurn: { type: Number, default: 0 },
    lastRoll: { type: Number, default: null },
    pendingShooterSlot: { type: String, default: null },
    winner: { type: Number, default: -1 },
    round: { type: Number, default: 1 },
    rematchVotes: { type: [Boolean], default: [false, false] },
    log: { type: [logEntrySchema], default: [] }
  },
  { timestamps: true }
);

// Abandoned rooms are removed automatically 24 h after their last move.
gameSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model('Game', gameSchema);
