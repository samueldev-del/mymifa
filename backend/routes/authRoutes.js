const express = require('express');
const router = express.Router();
const { login, session } = require('../controllers/authController');
const validate = require('../middlewares/validate');
const requireAuth = require('../middlewares/auth');
const { loginSchema } = require('../validators/authValidators');

// Publique : c'est la porte d'entrée.
router.post('/login', validate(loginSchema), login);

// Protégée : valide un jeton déjà stocké côté frontend.
router.get('/session', requireAuth, session);

module.exports = router;
