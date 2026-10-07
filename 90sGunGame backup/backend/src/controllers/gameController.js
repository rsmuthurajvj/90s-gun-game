'use strict';

const Game = require('../models/Game');

async function getGame(req, res, next) {
  try {
    const game = await Game.findOne({ roomId: req.params.roomId.toUpperCase().trim() })
      .select('-__v')
      .lean();
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    res.json(game);
  } catch (err) {
    next(err);
  }
}

async function listGames(req, res, next) {
  try {
    const games = await Game.find({ status: { $ne: 'finished' } })
      .select('roomId status players.name currentTurn createdAt')
      .lean()
      .limit(20);
    res.json(games);
  } catch (err) {
    next(err);
  }
}

module.exports = { getGame, listGames };
