'use strict';

const mongoose = require('mongoose');

// ── Soldier sub-document ─────────────────────────────────────────────────────
// stage  : 0  = empty
//          1  = head      2  = body    3  = legs    4  = arms
//          5  = gun       6-11 = loading bullets 1-6
//          After stage 11, bullets tracks remaining ammo (6 → 0)
// bullets: 0-6  (shooting ammo, set to 6 when stage reaches 11 or on reload)
// alive  : false when shot dead
// ─────────────────────────────────────────────────────────────────────────────

const soldierSchema = new mongoose.Schema(
  {
    stage: { type: Number, default: 0, min: 0, max: 11 },
    bullets: { type: Number, default: 0, min: 0, max: 6 },
    alive: { type: Boolean, default: true }
  },
  { _id: false }
);

// ── Player sub-document ──────────────────────────────────────────────────────

const playerSchema = new mongoose.Schema(
  {
    socketId: { type: String, default: '' },
    name: { type: String, required: true, trim: true, maxlength: 30 },
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

// ── Game log entry ───────────────────────────────────────────────────────────

const logEntrySchema = new mongoose.Schema(
  {
    message: { type: String },
    playerIndex: { type: Number },
    timestamp: { type: Date, default: () => new Date() }
  },
  { _id: false }
);

// ── Game document ─────────────────────────────────────────────────────────────

const gameSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, required: true, index: true },
    status: {
      type: String,
      enum: ['waiting', 'coin_toss', 'playing', 'choosing_target', 'finished'],
      default: 'waiting'
    },
    players: { type: [playerSchema], default: [] },
    currentTurn: { type: Number, default: 0 },  // 0 or 1
    lastRoll: { type: Number, default: null },
    pendingShooterSlot: { type: String, default: null }, // e.g. 's2'
    winner: { type: Number, default: -1 },
    log: { type: [logEntrySchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
