const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

const SELECT_FORMATION = `
    SELECT f.id, f.titre, f.organisme, f.statut, f.date_debut, f.date_fin,
           f.url, f.competences, f.notes, f.certificat_id,
           f.created_at, f.updated_at,
           d.libelle AS certificat_libelle, d.cle_s3 AS certificat_cle
    FROM formations f
    LEFT JOIN documents d ON f.certificat_id = d.id
`;

const listFormations = async (req, res) => {
    try {
        const result = await pool.query(
            `${SELECT_FORMATION}
             ORDER BY
               CASE f.statut
                 WHEN 'en_cours' THEN 0
                 WHEN 'prevue' THEN 1
                 WHEN 'terminee' THEN 2
                 ELSE 3
               END,
               COALESCE(f.date_fin, f.date_debut) DESC NULLS LAST,
               f.created_at DESC`
        );

        return sendSuccess(res, 200, result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des formations:', error);
        return sendError(res, 500, 'FORMATION_LIST_ERROR', 'Erreur lors de la récupération des formations.');
    }
};

const createFormation = async (req, res) => {
    const { titre, organisme, statut, date_debut, date_fin, url, competences, notes } = req.body;

    try {
        const creee = await pool.query(
            `INSERT INTO formations (titre, organisme, statut, date_debut, date_fin, url, competences, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
                titre,
                organisme || null,
                statut || 'prevue',
                date_debut || null,
                date_fin || null,
                url || null,
                competences || [],
                notes || null,
            ]
        );

        const complete = await pool.query(`${SELECT_FORMATION} WHERE f.id = $1`, [creee.rows[0].id]);
        return sendSuccess(res, 201, complete.rows[0], 'Formation ajoutée.');
    } catch (error) {
        console.error('Erreur lors de la création de la formation:', error);
        return sendError(res, 500, 'FORMATION_CREATE_ERROR', 'Erreur lors de la création de la formation.');
    }
};

const updateFormation = async (req, res) => {
    const { id } = req.params;
    const champsAutorises = [
        'titre',
        'organisme',
        'statut',
        'date_debut',
        'date_fin',
        'url',
        'competences',
        'notes',
        'certificat_id',
    ];

    const champs = [];
    const valeurs = [];
    let index = 1;

    for (const champ of champsAutorises) {
        if (req.body[champ] === undefined) continue;
        champs.push(`${champ} = $${index++}`);
        // Les chaînes vides deviennent NULL ; les tableaux sont conservés tels quels.
        const valeur = req.body[champ];
        valeurs.push(Array.isArray(valeur) ? valeur : valeur || null);
    }

    if (champs.length === 0) {
        return sendError(res, 400, 'FORMATION_UPDATE_EMPTY', 'Aucun changement à appliquer.');
    }

    valeurs.push(id);

    try {
        const misAJour = await pool.query(
            `UPDATE formations SET ${champs.join(', ')} WHERE id = $${index} RETURNING id`,
            valeurs
        );

        if (misAJour.rows.length === 0) {
            return sendError(res, 404, 'FORMATION_NOT_FOUND', 'Formation introuvable.');
        }

        const complete = await pool.query(`${SELECT_FORMATION} WHERE f.id = $1`, [id]);
        return sendSuccess(res, 200, complete.rows[0], 'Formation mise à jour.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la formation:', error);
        return sendError(res, 500, 'FORMATION_UPDATE_ERROR', 'Erreur lors de la mise à jour de la formation.');
    }
};

const deleteFormation = async (req, res) => {
    try {
        const supprimee = await pool.query('DELETE FROM formations WHERE id = $1 RETURNING id', [
            req.params.id,
        ]);

        if (supprimee.rows.length === 0) {
            return sendError(res, 404, 'FORMATION_NOT_FOUND', 'Formation introuvable.');
        }

        return sendSuccess(res, 200, { id: req.params.id }, 'Formation supprimée.');
    } catch (error) {
        console.error('Erreur lors de la suppression de la formation:', error);
        return sendError(res, 500, 'FORMATION_DELETE_ERROR', 'Erreur lors de la suppression de la formation.');
    }
};

module.exports = { listFormations, createFormation, updateFormation, deleteFormation };
