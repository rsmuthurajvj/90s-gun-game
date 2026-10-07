'use strict';

const express = require('express');
const router = express.Router();
const { getGame, listGames } = require('../controllers/gameController');

router.get('/', listGames);
router.get('/:roomId', getGame);

module.exports = router;
