const crypto = require('crypto');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');
const { lireMessagesRecents, estConfigure, FENETRE_JOURS } = require('../services/email');
const { STATUTS_CLOTURES } = require('../config/constants');

// Mots-clés de détection (français, anglais, allemand).
const MOTS_REFUS = [
    'unfortunately', 'malheureusement', 'leider', 'not proceeding', 'bedauern',
    'regret', 'absage', 'nicht weiter', 'anderen kandidaten',
];
const MOTS_ENTRETIEN = [
    'interview', 'entretien', 'einladung', 'next steps', 'kennenlernen',
    'termin', 'gespräch', 'vorstellungsgespräch',
];
const MOTS_ACCEPTE = [
    'offer', "offre d'emploi", 'angebot', 'congratulations', 'félicitations',
    'zusage', 'vertrag', 'arbeitsvertrag',
];

/** Suffixes juridiques à ignorer lors du rapprochement entreprise ↔ domaine. */
const SUFFIXES = /\b(gmbh|ag|se|kg|ohg|mbh|ug|sarl|sas|sa|inc|ltd|llc|bv|nv|co)\b/gi;

const normaliser = (valeur) =>
    (valeur || '')
        .toLowerCase()
        .replace(SUFFIXES, ' ')
        .replace(/[^a-z0-9]+/g, '')
        .trim();

const detecterStatut = (texte) => {
    const minuscule = (texte || '').toLowerCase();
    // L'ordre compte : un refus poli mentionne souvent « Gespräch ».
    if (MOTS_REFUS.some((mot) => minuscule.includes(mot))) return 'refuse';
    if (MOTS_ACCEPTE.some((mot) => minuscule.includes(mot))) return 'accepte';
    if (MOTS_ENTRETIEN.some((mot) => minuscule.includes(mot))) return 'entretien';
    return null;
};

/**
 * Rapproche un message d'une candidature.
 * Deux signaux : le domaine de l'expéditeur, et le nom de l'entreprise cité
 * dans le sujet ou le corps. Le premier prime, il est moins ambigu.
 */
const trouverCandidature = (message, candidatures) => {
    const domaine = normaliser((message.from.split('@')[1] || '').split('.')[0]);
    const contenu = `${message.subject} ${message.text}`.toLowerCase();

    if (domaine.length >= 3) {
        const parDomaine = candidatures.find((c) => {
            const entreprise = normaliser(c.entreprise_nom);
            return entreprise.length >= 3 && (entreprise.includes(domaine) || domaine.includes(entreprise));
        });
        if (parDomaine) return { candidature: parDomaine, via: 'domaine' };
    }

    const parNom = candidatures.find(
        (c) => c.entreprise_nom && c.entreprise_nom.length >= 4 && contenu.includes(c.entreprise_nom.toLowerCase())
    );
    if (parNom) return { candidature: parNom, via: 'nom' };

    return { candidature: null, via: null };
};

/**
 * Synchronisation IMAP : lit les messages récents, rapproche chacun d'une
 * candidature et met le statut à jour.
 *
 * Idempotente : chaque Message-ID traité est journalisé, donc relancer la
 * synchronisation ne rejoue rien et n'écrase aucun statut.
 */
const syncEmails = async (req, res) => {
    if (!estConfigure()) {
        return sendError(
            res,
            503,
            'IMAP_NOT_CONFIGURED',
            'Boîte mail non configurée (IMAP_HOST, IMAP_USER, IMAP_PASSWORD).'
        );
    }

    try {
        const [messages, candidatures, deja] = await Promise.all([
            lireMessagesRecents(),
            pool.query(
                `SELECT a.id, a.statut, a.titre_poste, c.nom AS entreprise_nom
                 FROM applications a
                 LEFT JOIN companies c ON a.company_id = c.id
                 WHERE a.statut NOT IN (${STATUTS_CLOTURES.map((_, i) => `$${i + 1}`).join(', ')})`,
                STATUTS_CLOTURES
            ),
            pool.query('SELECT message_id FROM emails_traites'),
        ]);

        const traites = new Set(deja.rows.map((r) => r.message_id));
        const actives = candidatures.rows;
        const journal = [];

        for (const message of messages) {
            if (traites.has(message.messageId)) continue;

            const statut = detecterStatut(`${message.subject} ${message.text}`);
            const { candidature, via } = statut
                ? trouverCandidature(message, actives)
                : { candidature: null, via: null };

            if (statut && candidature) {
                await pool.query('UPDATE applications SET statut = $1 WHERE id = $2', [
                    statut,
                    candidature.id,
                ]);
                // La liste en mémoire évite qu'un second message du même jour
                // rebascule une candidature déjà classée.
                candidature.statut = statut;

                journal.push({
                    de: message.from,
                    sujet: message.subject,
                    statut,
                    candidature: candidature.titre_poste,
                    via,
                });
            }

            await pool.query(
                `INSERT INTO emails_traites (message_id, expediteur, sujet, statut_detecte, application_id, recu_le)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (message_id) DO NOTHING`,
                [
                    message.messageId.slice(0, 998),
                    message.from.slice(0, 320),
                    (message.subject || '').slice(0, 512),
                    statut,
                    candidature?.id || null,
                    message.date,
                ]
            );
        }

        return sendSuccess(
            res,
            200,
            {
                messages_lus: messages.length,
                nouveaux: messages.filter((m) => !traites.has(m.messageId)).length,
                mises_a_jour: journal.length,
                details: journal,
                fenetre_jours: FENETRE_JOURS,
            },
            journal.length > 0
                ? `${journal.length} candidature(s) mise(s) à jour.`
                : 'Aucun changement détecté.'
        );
    } catch (error) {
        console.error('Erreur lors de la synchronisation IMAP:', error.message);
        return sendError(res, 502, 'IMAP_SYNC_ERROR', `Synchronisation impossible : ${error.message}`);
    }
};

// ----------------------------------------------------- webhook (optionnel)

/**
 * Le webhook reste disponible pour un fournisseur capable de pousser les mails
 * (SendGrid Inbound Parse, Mailgun…). Il est authentifié par son propre secret
 * partagé, puisqu'un service tiers ne peut pas porter de jeton de session.
 */
const verifierSecret = (req) => {
    const attendu = process.env.EMAIL_WEBHOOK_SECRET;
    if (!attendu) return false;

    const fourni = req.get('x-webhook-secret') || req.query.secret || '';
    const a = crypto.createHash('sha256').update(String(fourni)).digest();
    const b = crypto.createHash('sha256').update(attendu).digest();
    return crypto.timingSafeEqual(a, b);
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

module.exports = { handleIncomingEmail, syncEmails, verifierSecret, detecterStatut };
