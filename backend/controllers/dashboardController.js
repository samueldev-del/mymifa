const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

/** Pondération d'un mot-clé manquant selon son importance. */
const POIDS = { critique: 3, importante: 2, secondaire: 1 };

/**
 * Vue d'ensemble du tableau de bord : indicateurs, échéances et lacunes.
 * Une seule route pour éviter au frontend d'enchaîner six appels au chargement.
 */
const getDashboard = async (req, res) => {
    try {
        const [candidatures, entretiens, relances, formations, analyses] = await Promise.all([
            pool.query(`
                SELECT statut, COUNT(*)::int AS total,
                       AVG(ats_score) FILTER (WHERE ats_score IS NOT NULL) AS score_moyen
                FROM applications GROUP BY statut
            `),
            pool.query(`
                SELECT i.id, i.date_entretien, i.type_entretien, i.modalite, i.lieu,
                       i.questions_ia IS NOT NULL AS prepare,
                       a.id AS application_id, a.titre_poste, c.nom AS entreprise_nom
                FROM interviews i
                JOIN applications a ON i.application_id = a.id
                LEFT JOIN companies c ON a.company_id = c.id
                WHERE i.date_entretien >= CURRENT_TIMESTAMP - INTERVAL '2 hours'
                ORDER BY i.date_entretien ASC
                LIMIT 5
            `),
            pool.query(`
                SELECT r.id, r.libelle, r.echeance, r.application_id,
                       a.titre_poste, c.nom AS entreprise_nom,
                       (r.echeance < CURRENT_DATE) AS en_retard
                FROM relances r
                JOIN applications a ON r.application_id = a.id
                LEFT JOIN companies c ON a.company_id = c.id
                WHERE r.fait = FALSE
                ORDER BY r.echeance ASC
                LIMIT 6
            `),
            pool.query(`
                SELECT statut, COUNT(*)::int AS total FROM formations GROUP BY statut
            `),
            pool.query(`
                SELECT ats_analyse -> 'mots_cles_manquants' AS manquants
                FROM applications
                WHERE ats_analyse IS NOT NULL
            `),
        ]);

        // --- Indicateurs de candidatures ---
        const parStatut = Object.fromEntries(candidatures.rows.map((r) => [r.statut, r.total]));
        const total = candidatures.rows.reduce((somme, r) => somme + r.total, 0);
        const actives = (parStatut.envoye || 0) + (parStatut.entretien || 0);
        const envoyees = total - (parStatut.brouillon || 0);
        const scores = candidatures.rows
            .filter((r) => r.score_moyen !== null)
            .map((r) => ({ score: Number(r.score_moyen), poids: r.total }));
        const scoreMoyen = scores.length
            ? Math.round(
                  scores.reduce((s, x) => s + x.score * x.poids, 0) /
                      scores.reduce((s, x) => s + x.poids, 0)
              )
            : null;

        // --- Lacunes de compétences agrégées sur toutes les analyses ATS ---
        const compteur = new Map();
        for (const ligne of analyses.rows) {
            for (const mot of ligne.manquants || []) {
                const cle = String(mot.mot_cle || '').trim();
                if (!cle) continue;
                const normalise = cle.toLowerCase();
                const existant = compteur.get(normalise) || {
                    mot_cle: cle,
                    occurrences: 0,
                    poids: 0,
                    importance_max: 'secondaire',
                };
                existant.occurrences += 1;
                existant.poids += POIDS[mot.importance] || 1;
                if ((POIDS[mot.importance] || 1) > (POIDS[existant.importance_max] || 1)) {
                    existant.importance_max = mot.importance;
                }
                compteur.set(normalise, existant);
            }
        }

        // Une lacune est « couverte » si une formation prévue ou en cours la vise.
        const formationsCouvrantes = await pool.query(`
            SELECT DISTINCT LOWER(TRIM(competence)) AS competence
            FROM formations, UNNEST(competences) AS competence
            WHERE statut IN ('prevue', 'en_cours', 'terminee')
        `);
        const couvertes = new Set(formationsCouvrantes.rows.map((r) => r.competence));

        const lacunes = [...compteur.values()]
            .map((l) => ({ ...l, couverte: couvertes.has(l.mot_cle.toLowerCase()) }))
            .sort((a, b) => b.poids - a.poids || b.occurrences - a.occurrences)
            .slice(0, 12);

        return sendSuccess(res, 200, {
            candidatures: {
                total,
                actives,
                envoyees,
                par_statut: parStatut,
                score_ats_moyen: scoreMoyen,
                taux_entretien: envoyees > 0 ? Math.round(((parStatut.entretien || 0) / envoyees) * 100) : null,
            },
            entretiens_a_venir: entretiens.rows,
            relances_en_attente: relances.rows,
            formations: {
                par_statut: Object.fromEntries(formations.rows.map((r) => [r.statut, r.total])),
                total: formations.rows.reduce((s, r) => s + r.total, 0),
            },
            lacunes,
        });
    } catch (error) {
        console.error('Erreur lors du calcul du tableau de bord:', error);
        return sendError(res, 500, 'DASHBOARD_ERROR', 'Erreur lors du calcul du tableau de bord.');
    }
};

module.exports = { getDashboard };
