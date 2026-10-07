'use strict';

const express = require('express');
const router = express.Router();
const { getGame } = require('../controllers/gameController');

router.get('/:roomId', getGame);

module.exports = router;
