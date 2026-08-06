const crypto = require('crypto');

/**
 * Jetons de session signés en HMAC-SHA256, sans dépendance externe.
 * Format : base64url(payload).base64url(signature)
 *
 * Le secret est SESSION_SECRET s'il existe, sinon dérivé de ADMIN_PASSWORD :
 * changer le mot de passe invalide alors automatiquement les sessions ouvertes.
 */
const DUREE_SESSION_MS = 12 * 60 * 60 * 1000; // 12 heures

const getSecret = () => {
    const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
    if (!secret) {
        throw new Error('ADMIN_PASSWORD (ou SESSION_SECRET) doit être défini.');
    }
    return secret;
};

const base64url = (buffer) => Buffer.from(buffer).toString('base64url');

const signer = (donnees) => crypto.createHmac('sha256', getSecret()).update(donnees).digest();

const creerToken = () => {
    const payload = base64url(
        JSON.stringify({
            sub: 'admin',
            iat: Date.now(),
            exp: Date.now() + DUREE_SESSION_MS,
        })
    );

    return `${payload}.${base64url(signer(payload))}`;
};

/** @returns {boolean} true si le jeton est authentique et non expiré. */
const verifierToken = (token) => {
    if (typeof token !== 'string') return false;

    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;

    const attendue = base64url(signer(payload));

    // Comparaison à temps constant : les deux buffers doivent avoir la même taille.
    const a = Buffer.from(signature);
    const b = Buffer.from(attendue);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    try {
        const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return typeof exp === 'number' && Date.now() < exp;
    } catch {
        return false;
    }
};

/** Comparaison à temps constant du mot de passe admin. */
const verifierMotDePasse = (candidat) => {
    const attendu = process.env.ADMIN_PASSWORD;
    if (!attendu || typeof candidat !== 'string') return false;

    const a = crypto.createHash('sha256').update(candidat).digest();
    const b = crypto.createHash('sha256').update(attendu).digest();
    return crypto.timingSafeEqual(a, b);
};

module.exports = {
    creerToken,
    verifierToken,
    verifierMotDePasse,
    DUREE_SESSION_MS,
};
