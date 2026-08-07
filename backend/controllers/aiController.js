const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');
const { telechargerObjet, cleDepuisUrl } = require('../services/s3');

const MODELE = 'claude-opus-5';

/** Langue de rédaction demandée à Claude. L'allemand est le défaut. */
const LANGUES = { de: 'allemand', en: 'anglais', fr: 'français' };

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const journaliserErreurIA = (contexte, error) => {
    console.error(`--- ERREUR ANTHROPIC (${contexte}) ---`);
    console.error('Message:', error.message);
    console.error('Statut HTTP:', error.status);
    if (error.error) console.error('Détails API:', error.error);
    console.error('------------------------');
};

/** Contexte candidat tiré du profil, ignoré s'il est vide. */
const lireProfil = async () => {
    try {
        const { rows } = await pool.query(
            'SELECT nom, titre_professionnel, email, telephone, ville FROM profil WHERE id = 1'
        );
        return rows[0] || null;
    } catch (error) {
        // Une lettre sans identité vaut mieux qu'une erreur : on dégrade.
        console.error('Profil illisible pour la génération de lettre:', error.message);
        return null;
    }
};

const generateLetter = async (req, res) => {
    const { description_offre, nom_entreprise } = req.body;
    const langue = LANGUES[req.body.langue] || LANGUES.de;

    const systemPrompt = [
        'Tu es un expert en recrutement pour le marché IT allemand (DevOps, Cloud).',
        'Rédige une lettre de motivation percutante, professionnelle mais moderne.',
        "Ne génère que le corps de la lettre, sans les en-têtes d'adresses.",
        'Signe avec le nom du candidat quand il est fourni.',
        'Réponds uniquement avec la lettre, sans préambule ni commentaire.',
        `Rédige intégralement en ${langue}.`,
    ].join(' ');

    try {
        const profil = await lireProfil();

        const identite = profil
            ? [
                  'Le candidat :',
                  profil.nom && `- Nom : ${profil.nom}`,
                  profil.titre_professionnel && `- Titre : ${profil.titre_professionnel}`,
                  profil.ville && `- Ville : ${profil.ville}`,
              ]
                  .filter(Boolean)
                  .join('\n')
            : '';

        const msg = await anthropic.messages.create({
            model: MODELE,
            max_tokens: 4000,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: [
                        identite,
                        `Voici l'offre pour l'entreprise ${nom_entreprise} :`,
                        '',
                        description_offre,
                        '',
                        'Rédige la lettre de motivation.',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                },
            ],
        });

        if (msg.stop_reason === 'refusal') {
            return sendError(res, 422, 'AI_REFUSAL', 'L\'IA n\'a pas pu traiter cette demande.');
        }

        const texte = msg.content.find((bloc) => bloc.type === 'text')?.text || '';
        return sendSuccess(res, 200, { letter: texte }, 'Lettre générée avec succès.');
    } catch (error) {
        journaliserErreurIA('generateLetter', error);
        return sendError(res, 500, 'AI_GENERATION_ERROR', 'Erreur lors de la génération de la lettre avec l\'IA.');
    }
};

/** Schéma imposé au modèle : garantit un JSON exploitable côté frontend. */
const SCHEMA_ATS = {
    type: 'object',
    properties: {
        score: {
            type: 'integer',
            description: 'Score de compatibilité entre le CV et l\'offre, de 0 à 100.',
        },
        synthese: {
            type: 'string',
            description: 'Synthèse en 2 à 3 phrases de l\'adéquation du profil.',
        },
        mots_cles_manquants: {
            type: 'array',
            description: 'Mots-clés ou compétences présents dans l\'offre mais absents du CV.',
            items: {
                type: 'object',
                properties: {
                    mot_cle: { type: 'string' },
                    importance: { type: 'string', enum: ['critique', 'importante', 'secondaire'] },
                },
                required: ['mot_cle', 'importance'],
                additionalProperties: false,
            },
        },
        points_forts: {
            type: 'array',
            description: 'Points du CV qui correspondent bien à l\'offre.',
            items: { type: 'string' },
        },
        recommandations: {
            type: 'array',
            description: 'Actions concrètes pour améliorer le score.',
            items: { type: 'string' },
        },
    },
    required: ['score', 'synthese', 'mots_cles_manquants', 'points_forts', 'recommandations'],
    additionalProperties: false,
};

/**
 * Analyse ATS : envoie le PDF du CV directement à Claude (lecture PDF native,
 * pas d'extraction de texte côté serveur) avec la description du poste, et
 * renvoie un score de compatibilité + les mots-clés manquants.
 */
const analyseATS = async (req, res) => {
    const { application_id, document_id } = req.body;

    try {
        const candidature = await pool.query(
            `SELECT a.id, a.titre_poste, a.description_offre, c.nom AS entreprise_nom
             FROM applications a
             LEFT JOIN companies c ON a.company_id = c.id
             WHERE a.id = $1`,
            [application_id]
        );

        if (candidature.rows.length === 0) {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        const offre = candidature.rows[0];
        if (!offre.description_offre || offre.description_offre.trim().length < 30) {
            return sendError(
                res,
                400,
                'ATS_DESCRIPTION_MISSING',
                'La description de l\'offre est trop courte pour une analyse pertinente. Complétez-la dans l\'onglet Informations.'
            );
        }

        const doc = await pool.query(
            `SELECT id, url_fichier, cle_s3, libelle FROM documents WHERE id = $1`,
            [document_id]
        );

        if (doc.rows.length === 0) {
            return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
        }

        const document = doc.rows[0];
        const cle = document.cle_s3 || cleDepuisUrl(document.url_fichier);

        if (!cle || !cle.toLowerCase().endsWith('.pdf')) {
            return sendError(
                res,
                400,
                'ATS_PDF_REQUIRED',
                'L\'analyse ATS nécessite un CV au format PDF.'
            );
        }

        const fichier = await telechargerObjet(cle);

        const msg = await anthropic.messages.create({
            model: MODELE,
            max_tokens: 8000,
            system: [
                "Tu es un moteur d'analyse ATS (Applicant Tracking System).",
                'Compare le CV fourni à la description de poste et évalue objectivement la compatibilité.',
                'Le score reflète la couverture des compétences, technologies et exigences de l\'offre par le CV.',
                'Sois précis et exigeant : ne gonfle pas le score.',
                'Réponds en français.',
            ].join(' '),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: fichier.toString('base64'),
                            },
                        },
                        {
                            type: 'text',
                            text: [
                                `Poste : ${offre.titre_poste}`,
                                `Entreprise : ${offre.entreprise_nom || 'non précisée'}`,
                                '',
                                "Description de l'offre :",
                                offre.description_offre,
                                '',
                                'Analyse la compatibilité entre le CV ci-joint et cette offre.',
                            ].join('\n'),
                        },
                    ],
                },
            ],
            output_config: {
                format: { type: 'json_schema', schema: SCHEMA_ATS },
            },
        });

        if (msg.stop_reason === 'refusal') {
            return sendError(res, 422, 'AI_REFUSAL', 'L\'IA n\'a pas pu traiter cette analyse.');
        }

        const brut = msg.content.find((bloc) => bloc.type === 'text')?.text;
        if (!brut) {
            return sendError(res, 502, 'ATS_EMPTY_RESPONSE', 'L\'IA n\'a renvoyé aucun résultat.');
        }

        const analyse = JSON.parse(brut);
        analyse.score = Math.max(0, Math.min(100, Number(analyse.score) || 0));

        const resultat = {
            ...analyse,
            document_id: document.id,
            document_libelle: document.libelle,
        };

        await pool.query(
            `UPDATE applications
             SET ats_score = $1, ats_analyse = $2, ats_analyse_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [analyse.score, JSON.stringify(resultat), application_id]
        );

        return sendSuccess(res, 200, resultat, 'Analyse ATS terminée.');
    } catch (error) {
        journaliserErreurIA('analyseATS', error);
        return sendError(res, 500, 'ATS_ANALYSIS_ERROR', 'Erreur lors de l\'analyse ATS.');
    }
};

/** Renvoie la dernière analyse enregistrée, sans rappeler l'IA. */
const getAnalyseATS = async (req, res) => {
    const { applicationId } = req.params;

    try {
        const result = await pool.query(
            'SELECT ats_score, ats_analyse, ats_analyse_at FROM applications WHERE id = $1',
            [applicationId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        const { ats_analyse, ats_analyse_at } = result.rows[0];
        return sendSuccess(res, 200, ats_analyse ? { ...ats_analyse, analyse_le: ats_analyse_at } : null);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'analyse ATS:', error);
        return sendError(res, 500, 'ATS_FETCH_ERROR', 'Erreur lors de la récupération de l\'analyse.');
    }
};

module.exports = { generateLetter, analyseATS, getAnalyseATS };
