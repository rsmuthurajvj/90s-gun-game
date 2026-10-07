'use strict';

const Game = require('../models/Game');
const { formatGame } = require('../socket/gameSocket');

async function getGame(req, res, next) {
  try {
    const game = await Game.findOne({ roomId: req.params.roomId.toUpperCase().trim() });
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    res.json(formatGame(game));
  } catch (err) {
    next(err);
  }
}

module.exports = { getGame };
