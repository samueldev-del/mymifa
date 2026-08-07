const express = require('express');
const router = express.Router();
const { handleIncomingEmail, syncEmails, verifierSecret } = require('../controllers/emailController');
const requireAuth = require('../middlewares/auth');
const { sendError } = require('../utils/http');

/**
 * La synchronisation est déclenchée de deux façons :
 *  - par un planificateur externe (GitHub Actions), qui présente le secret
 *    partagé faute de pouvoir tenir une session ;
 *  - par l'utilisateur depuis l'interface, avec son jeton de session.
 */
const secretOuSession = (req, res, next) => {
    if (verifierSecret(req)) return next();

    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return requireAuth(req, res, next);

    return sendError(res, 401, 'SYNC_UNAUTHORIZED', 'Secret de synchronisation ou session requis.');
};

router.post('/sync', secretOuSession, syncEmails);

// Appelée par un fournisseur d'email capable de pousser les messages.
// Authentifiée par son propre secret partagé, vérifié dans le contrôleur.
router.post('/webhook', handleIncomingEmail);

module.exports = router;
