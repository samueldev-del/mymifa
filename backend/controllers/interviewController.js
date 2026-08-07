const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');
const { telechargerObjet, cleDepuisUrl } = require('../services/s3');

const MODELE = 'claude-opus-5';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SELECT_INTERVIEW = `
    SELECT i.id, i.application_id, i.date_entretien, i.type_entretien, i.modalite,
           i.lieu, i.contact_id, i.notes_prepa, i.questions_ia, i.reponses_star,
           i.questions_a_poser, i.bilan, i.created_at, i.updated_at,
           a.titre_poste, a.description_offre, c.nom AS entreprise_nom,
           ct.nom AS contact_nom
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    LEFT JOIN companies c ON a.company_id = c.id
    LEFT JOIN contacts ct ON i.contact_id = ct.id
`;

const listInterviews = async (req, res) => {
    const { applicationId, aVenir } = req.query;

    const conditions = [];
    const valeurs = [];

    if (applicationId) {
        valeurs.push(applicationId);
        conditions.push(`i.application_id = $${valeurs.length}`);
    }

    if (aVenir === 'true') conditions.push('i.date_entretien >= CURRENT_TIMESTAMP');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const ordre = aVenir === 'true' ? 'ASC' : 'DESC';

    try {
        const result = await pool.query(
            `${SELECT_INTERVIEW} ${where} ORDER BY i.date_entretien ${ordre}`,
            valeurs
        );
        return sendSuccess(res, 200, result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des entretiens:', error);
        return sendError(res, 500, 'INTERVIEW_LIST_ERROR', 'Erreur lors de la récupération des entretiens.');
    }
};

const createInterview = async (req, res) => {
    const { application_id, date_entretien, type_entretien, modalite, lieu, contact_id, notes_prepa } =
        req.body;

    try {
        const creee = await pool.query(
            `INSERT INTO interviews (application_id, date_entretien, type_entretien, modalite, lieu, contact_id, notes_prepa)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                application_id,
                date_entretien,
                type_entretien || 'rh',
                modalite || 'visio',
                lieu || null,
                contact_id || null,
                notes_prepa || null,
            ]
        );

        // Un entretien planifié implique que la candidature est à ce stade.
        await pool.query(
            `UPDATE applications SET statut = 'entretien'
             WHERE id = $1 AND statut NOT IN ('refuse', 'accepte')`,
            [application_id]
        );

        const complet = await pool.query(`${SELECT_INTERVIEW} WHERE i.id = $1`, [creee.rows[0].id]);
        return sendSuccess(res, 201, complet.rows[0], 'Entretien planifié.');
    } catch (error) {
        if (error.code === '23503') {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }
        console.error('Erreur lors de la création de l\'entretien:', error);
        return sendError(res, 500, 'INTERVIEW_CREATE_ERROR', 'Erreur lors de la création de l\'entretien.');
    }
};

const updateInterview = async (req, res) => {
    const { id } = req.params;
    const champsAutorises = [
        'date_entretien',
        'type_entretien',
        'modalite',
        'lieu',
        'contact_id',
        'notes_prepa',
        'reponses_star',
        'questions_a_poser',
        'bilan',
    ];
    const champsJson = new Set(['reponses_star', 'questions_a_poser']);

    const champs = [];
    const valeurs = [];
    let index = 1;

    for (const champ of champsAutorises) {
        if (req.body[champ] === undefined) continue;
        champs.push(`${champ} = $${index++}`);
        const valeur = req.body[champ];
        valeurs.push(champsJson.has(champ) ? JSON.stringify(valeur) : valeur || null);
    }

    if (champs.length === 0) {
        return sendError(res, 400, 'INTERVIEW_UPDATE_EMPTY', 'Aucun changement à appliquer.');
    }

    valeurs.push(id);

    try {
        const misAJour = await pool.query(
            `UPDATE interviews SET ${champs.join(', ')} WHERE id = $${index} RETURNING id`,
            valeurs
        );

        if (misAJour.rows.length === 0) {
            return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Entretien introuvable.');
        }

        const complet = await pool.query(`${SELECT_INTERVIEW} WHERE i.id = $1`, [id]);
        return sendSuccess(res, 200, complet.rows[0], 'Entretien mis à jour.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'entretien:', error);
        return sendError(res, 500, 'INTERVIEW_UPDATE_ERROR', 'Erreur lors de la mise à jour de l\'entretien.');
    }
};

const deleteInterview = async (req, res) => {
    try {
        const supprime = await pool.query('DELETE FROM interviews WHERE id = $1 RETURNING id', [
            req.params.id,
        ]);

        if (supprime.rows.length === 0) {
            return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Entretien introuvable.');
        }

        return sendSuccess(res, 200, { id: req.params.id }, 'Entretien supprimé.');
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'entretien:', error);
        return sendError(res, 500, 'INTERVIEW_DELETE_ERROR', 'Erreur lors de la suppression de l\'entretien.');
    }
};

// ------------------------------------------------- préparation assistée (IA)

const SCHEMA_PREPA = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            description: 'Questions que le recruteur est susceptible de poser.',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    categorie: {
                        type: 'string',
                        enum: ['technique', 'experience', 'comportementale', 'motivation', 'salaire'],
                    },
                    pourquoi: {
                        type: 'string',
                        description: 'Ce que le recruteur cherche réellement à évaluer.',
                    },
                    piste_reponse: {
                        type: 'string',
                        description: 'Angle d\'attaque conseillé, appuyé sur le CV quand c\'est possible.',
                    },
                },
                required: ['question', 'categorie', 'pourquoi', 'piste_reponse'],
                additionalProperties: false,
            },
        },
        questions_a_poser: {
            type: 'array',
            description: 'Questions pertinentes à poser au recruteur.',
            items: { type: 'string' },
        },
        points_de_vigilance: {
            type: 'array',
            description: 'Faiblesses du profil sur lesquelles le candidat sera probablement challengé.',
            items: { type: 'string' },
        },
        fiche_entreprise: {
            type: 'string',
            description: 'Ce qu\'il faut retenir du poste et de l\'entreprise, en quelques phrases.',
        },
    },
    required: ['questions', 'questions_a_poser', 'points_de_vigilance', 'fiche_entreprise'],
    additionalProperties: false,
};

const LANGUES = {
    de: 'allemand',
    en: 'anglais',
    fr: 'français',
};

/**
 * Génère un dossier de préparation à partir de l'offre et, si un CV PDF est
 * attaché, du CV lui-même (lu nativement par Claude).
 * La langue de sortie suit l'entretien : en Allemagne, on se prépare en allemand.
 */
const preparerInterview = async (req, res) => {
    const { id } = req.params;
    const langue = LANGUES[req.body.langue] || LANGUES.de;

    try {
        const entretien = await pool.query(`${SELECT_INTERVIEW} WHERE i.id = $1`, [id]);

        if (entretien.rows.length === 0) {
            return sendError(res, 404, 'INTERVIEW_NOT_FOUND', 'Entretien introuvable.');
        }

        const info = entretien.rows[0];

        if (!info.description_offre || info.description_offre.trim().length < 30) {
            return sendError(
                res,
                400,
                'INTERVIEW_DESCRIPTION_MISSING',
                'La description de l\'offre est trop courte pour préparer l\'entretien.'
            );
        }

        // Le CV le plus récent attaché à la candidature, s'il existe en PDF.
        const cv = await pool.query(
            `SELECT cle_s3, url_fichier FROM documents
             WHERE application_id = $1 AND type_document = 'cv'
             ORDER BY created_at DESC LIMIT 1`,
            [info.application_id]
        );

        const contenu = [];
        const cleCv = cv.rows[0] ? cv.rows[0].cle_s3 || cleDepuisUrl(cv.rows[0].url_fichier) : null;

        if (cleCv && cleCv.toLowerCase().endsWith('.pdf')) {
            const fichier = await telechargerObjet(cleCv);
            contenu.push({
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: fichier.toString('base64'),
                },
            });
        }

        contenu.push({
            type: 'text',
            text: [
                `Poste : ${info.titre_poste}`,
                `Entreprise : ${info.entreprise_nom || 'non précisée'}`,
                `Type d'entretien : ${info.type_entretien}`,
                `Modalité : ${info.modalite}`,
                '',
                "Description de l'offre :",
                info.description_offre,
                '',
                info.notes_prepa ? `Notes du candidat :\n${info.notes_prepa}\n` : '',
                cleCv
                    ? 'Le CV du candidat est joint : appuie tes pistes de réponse dessus.'
                    : "Aucun CV n'est joint : reste générique sur les pistes de réponse.",
            ]
                .filter(Boolean)
                .join('\n'),
        });

        const msg = await anthropic.messages.create({
            model: MODELE,
            max_tokens: 12000,
            system: [
                "Tu prépares un candidat à un entretien d'embauche dans l'IT.",
                'Génère entre 8 et 12 questions réellement probables pour ce poste et ce type d\'entretien,',
                'des questions pertinentes à poser au recruteur, et les points faibles du profil',
                'sur lesquels il sera challengé.',
                'Sois concret et spécifique à l\'offre : évite les banalités applicables à n\'importe quel poste.',
                `Rédige intégralement en ${langue}.`,
            ].join(' '),
            messages: [{ role: 'user', content: contenu }],
            output_config: { format: { type: 'json_schema', schema: SCHEMA_PREPA } },
        });

        if (msg.stop_reason === 'refusal') {
            return sendError(res, 422, 'AI_REFUSAL', 'L\'IA n\'a pas pu traiter cette demande.');
        }

        const brut = msg.content.find((bloc) => bloc.type === 'text')?.text;
        if (!brut) {
            return sendError(res, 502, 'INTERVIEW_PREP_EMPTY', 'L\'IA n\'a renvoyé aucun résultat.');
        }

        const prepa = JSON.parse(brut);

        await pool.query(
            `UPDATE interviews
             SET questions_ia = $1, questions_a_poser = $2
             WHERE id = $3`,
            [JSON.stringify(prepa), JSON.stringify(prepa.questions_a_poser), id]
        );

        return sendSuccess(res, 200, prepa, 'Préparation générée.');
    } catch (error) {
        console.error('Erreur lors de la préparation de l\'entretien:', error.message);
        return sendError(res, 500, 'INTERVIEW_PREP_ERROR', 'Erreur lors de la génération de la préparation.');
    }
};

module.exports = {
    listInterviews,
    createInterview,
    updateInterview,
    deleteInterview,
    preparerInterview,
};
