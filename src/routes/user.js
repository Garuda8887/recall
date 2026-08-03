const express = require('express');
const { changePassword } = require('../controllers/userController');

function getUserRouter({ db, requireAuth }) {
  const router = express.Router();

  router.post('/change-password', requireAuth, changePassword(db));

  return router;
}

module.exports = getUserRouter;
