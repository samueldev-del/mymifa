const express = require('express');
const router = express.Router();
const { handleIncomingEmail } = require('../controllers/emailController');

// Appelée par le fournisseur d'email (SendGrid, etc.).
// Non protégée par le jeton de session : elle vérifie son propre secret
// partagé (EMAIL_WEBHOOK_SECRET) dans le contrôleur.
router.post('/webhook', handleIncomingEmail);

module.exports = router;
