const { sendError } = require('../utils/http');
const { verifierToken } = require('../utils/token');

/**
 * Rejette toute requête sans jeton de session valide.
 * Appliqué globalement dans index.js ; seules /api/health, /api/auth/login et
 * le webhook email (authentifié par son propre secret) y échappent.
 */
const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    const [schema, token] = header.split(' ');

    if (schema !== 'Bearer' || !token) {
        return sendError(res, 401, 'AUTH_REQUIRED', 'Authentification requise.');
    }

    if (!verifierToken(token)) {
        return sendError(res, 401, 'AUTH_INVALID', 'Session expirée ou invalide.');
    }

    return next();
};

module.exports = requireAuth;
