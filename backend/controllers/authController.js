const { sendSuccess, sendError } = require('../utils/http');
const { creerToken, verifierMotDePasse, DUREE_SESSION_MS } = require('../utils/token');

/** Limitation de débit en mémoire : freine le bruteforce du mot de passe unique. */
const tentatives = new Map();
const FENETRE_MS = 15 * 60 * 1000;
const MAX_TENTATIVES = 10;

const enregistrerEchec = (ip) => {
    const maintenant = Date.now();
    const entree = tentatives.get(ip);

    if (!entree || maintenant > entree.reset) {
        tentatives.set(ip, { count: 1, reset: maintenant + FENETRE_MS });
        return;
    }

    entree.count += 1;
};

const estBloque = (ip) => {
    const entree = tentatives.get(ip);
    if (!entree) return false;
    if (Date.now() > entree.reset) {
        tentatives.delete(ip);
        return false;
    }
    return entree.count >= MAX_TENTATIVES;
};

const login = (req, res) => {
    const ip = req.ip || 'inconnue';

    if (estBloque(ip)) {
        return sendError(res, 429, 'AUTH_TOO_MANY_ATTEMPTS', 'Trop de tentatives. Réessayez dans quelques minutes.');
    }

    if (!process.env.ADMIN_PASSWORD) {
        console.error('ADMIN_PASSWORD n\'est pas défini : connexion impossible.');
        return sendError(res, 500, 'AUTH_NOT_CONFIGURED', 'Authentification non configurée côté serveur.');
    }

    if (!verifierMotDePasse(req.body.password)) {
        enregistrerEchec(ip);
        return sendError(res, 401, 'AUTH_INVALID_PASSWORD', 'Mot de passe incorrect.');
    }

    tentatives.delete(ip);

    return sendSuccess(
        res,
        200,
        { token: creerToken(), expiresIn: DUREE_SESSION_MS },
        'Connexion réussie.'
    );
};

/** Permet au frontend de valider un jeton stocké au démarrage. */
const session = (req, res) => sendSuccess(res, 200, { authenticated: true });

module.exports = { login, session };
