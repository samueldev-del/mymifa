const crypto = require('crypto');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

// Mots-clés de détection (français, anglais, allemand).
const MOTS_REFUS = ['unfortunately', 'malheureusement', 'leider', 'not proceeding', 'bedauern', 'regret'];
const MOTS_ENTRETIEN = ['interview', 'entretien', 'einladung', 'next steps', 'kennenlernen', 'termin'];
const MOTS_ACCEPTE = ['offer', 'offre d\'emploi', 'angebot', 'congratulations', 'félicitations', 'zusage'];

/**
 * Le webhook est la seule route publique en écriture : il est appelé par le
 * fournisseur d'email, qui ne peut pas porter de jeton de session. Il est donc
 * protégé par son propre secret partagé (EMAIL_WEBHOOK_SECRET).
 */
const verifierSecret = (req) => {
    const attendu = process.env.EMAIL_WEBHOOK_SECRET;
    if (!attendu) return false;

    const fourni = req.get('x-webhook-secret') || req.query.secret || '';
    const a = crypto.createHash('sha256').update(String(fourni)).digest();
    const b = crypto.createHash('sha256').update(attendu).digest();
    return crypto.timingSafeEqual(a, b);
};

const detecterStatut = (texte) => {
    const minuscule = texte.toLowerCase();
    if (MOTS_REFUS.some((mot) => minuscule.includes(mot))) return 'refuse';
    if (MOTS_ACCEPTE.some((mot) => minuscule.includes(mot))) return 'accepte';
    if (MOTS_ENTRETIEN.some((mot) => minuscule.includes(mot))) return 'entretien';
    return null;
};

const handleIncomingEmail = async (req, res) => {
    if (!verifierSecret(req)) {
        return sendError(res, 401, 'WEBHOOK_UNAUTHORIZED', 'Secret de webhook invalide ou absent.');
    }

    try {
        const { from, subject, text } = req.body;

        if (!from || !text) {
            return sendError(res, 400, 'WEBHOOK_PAYLOAD_INVALID', 'Champs "from" et "text" requis.');
        }

        const nouveauStatut = detecterStatut(`${subject || ''} ${text}`);

        if (!nouveauStatut) {
            return sendSuccess(res, 200, { updated: 0 }, 'Aucun changement de statut détecté.');
        }

        const domaine = (from.split('@')[1] || '').split('.')[0];
        if (!domaine) {
            return sendSuccess(res, 200, { updated: 0 }, 'Expéditeur non exploitable.');
        }

        // entreprise_nom n'existe pas sur `applications` : c'est companies.nom.
        // L'ancienne requête échouait donc systématiquement.
        const result = await pool.query(
            `UPDATE applications a
             SET statut = $1
             FROM companies c
             WHERE a.company_id = c.id
               AND c.nom ILIKE $2
               AND a.statut NOT IN ('refuse', 'accepte')
             RETURNING a.id, a.titre_poste`,
            [nouveauStatut, `%${domaine}%`]
        );

        console.log(
            `Webhook email : ${result.rows.length} candidature(s) passée(s) en "${nouveauStatut}" pour "${domaine}".`
        );

        return sendSuccess(
            res,
            200,
            { updated: result.rows.length, statut: nouveauStatut, applications: result.rows },
            'Webhook traité.'
        );
    } catch (error) {
        console.error('Erreur lors du traitement du webhook email:', error);
        return sendError(res, 500, 'WEBHOOK_ERROR', 'Erreur interne du webhook.');
    }
};

module.exports = { handleIncomingEmail };
