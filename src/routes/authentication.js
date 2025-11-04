const express = require('express');
const router = express.Router();
const controller = require('../controllers/authentication.js');

router.post("/login", controller.userLogin);
router.post("/signup", controller.userSignup);
router.post("/confirm", controller.confirmUser);

module.exports = router;