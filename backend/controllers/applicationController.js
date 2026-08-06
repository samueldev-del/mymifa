const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

const SELECT_APPLICATION = `
    SELECT a.id, a.titre_poste, a.url_offre, a.description_offre, a.statut,
           a.notes, a.ats_score, a.date_envoi, a.created_at, a.updated_at,
           c.nom AS entreprise_nom, c.id AS company_id
    FROM applications a
    LEFT JOIN companies c ON a.company_id = c.id
`;

/**
 * Résout l'entreprise par son nom, la crée si nécessaire.
 * Doit recevoir le client de la transaction en cours : utiliser `pool` ici
 * enverrait la requête sur une autre connexion, hors transaction.
 */
const resoudreEntreprise = async (client, nom) => {
    const existante = await client.query('SELECT id FROM companies WHERE nom = $1', [nom]);
    if (existante.rows.length > 0) return existante.rows[0].id;

    const creee = await client.query('INSERT INTO companies (nom) VALUES ($1) RETURNING id', [nom]);
    return creee.rows[0].id;
};

const getApplications = async (req, res) => {
    try {
        const result = await pool.query(`${SELECT_APPLICATION} ORDER BY a.created_at DESC`);
        return sendSuccess(res, 200, result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des candidatures:', error);
        return sendError(res, 500, 'APPLICATION_LIST_ERROR', 'Erreur serveur lors de la récupération des candidatures.');
    }
};

const getApplication = async (req, res) => {
    try {
        const result = await pool.query(`${SELECT_APPLICATION} WHERE a.id = $1`, [req.params.id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        return sendSuccess(res, 200, result.rows[0]);
    } catch (error) {
        console.error('Erreur lors de la récupération de la candidature:', error);
        return sendError(res, 500, 'APPLICATION_FETCH_ERROR', 'Erreur serveur lors de la récupération de la candidature.');
    }
};

const createApplication = async (req, res) => {
    const { nom_entreprise, titre_poste, url_offre, description_offre, notes } = req.body;

    // Un client dédié : BEGIN/COMMIT doivent emprunter la même connexion.
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const companyId = await resoudreEntreprise(client, nom_entreprise);

        const creee = await client.query(
            `INSERT INTO applications (company_id, titre_poste, url_offre, description_offre, notes, statut)
             VALUES ($1, $2, $3, $4, $5, 'brouillon')
             RETURNING id`,
            [companyId, titre_poste, url_offre || null, description_offre || null, notes || null]
        );

        const complete = await client.query(`${SELECT_APPLICATION} WHERE a.id = $1`, [creee.rows[0].id]);

        await client.query('COMMIT');
        return sendSuccess(res, 201, complete.rows[0], 'Candidature créée avec succès.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erreur lors de la création de la candidature:', error);
        return sendError(res, 500, 'APPLICATION_CREATE_ERROR', 'Erreur serveur lors de la création de la candidature.');
    } finally {
        client.release();
    }
};

const updateApplication = async (req, res) => {
    const { id } = req.params;
    const { nom_entreprise, titre_poste, url_offre, description_offre, statut, notes } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existante = await client.query(
            'SELECT company_id, statut, date_envoi FROM applications WHERE id = $1',
            [id]
        );

        if (existante.rows.length === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        const actuelle = existante.rows[0];
        const champs = [];
        const valeurs = [];
        let index = 1;

        const ajouter = (colonne, valeur) => {
            champs.push(`${colonne} = $${index++}`);
            valeurs.push(valeur);
        };

        if (nom_entreprise !== undefined) {
            const companyId = await resoudreEntreprise(client, nom_entreprise);
            if (companyId !== actuelle.company_id) ajouter('company_id', companyId);
        }

        if (titre_poste !== undefined) ajouter('titre_poste', titre_poste);
        if (url_offre !== undefined) ajouter('url_offre', url_offre || null);
        if (description_offre !== undefined) ajouter('description_offre', description_offre || null);
        if (notes !== undefined) ajouter('notes', notes || null);

        if (statut !== undefined) {
            ajouter('statut', statut);
            // Horodate le premier passage à « envoyé ».
            if (statut === 'envoye' && !actuelle.date_envoi) {
                ajouter('date_envoi', new Date());
            }
        }

        if (champs.length === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 400, 'APPLICATION_UPDATE_EMPTY', 'Aucun changement à appliquer.');
        }

        valeurs.push(id);
        await client.query(
            `UPDATE applications SET ${champs.join(', ')} WHERE id = $${index}`,
            valeurs
        );

        const misAJour = await client.query(`${SELECT_APPLICATION} WHERE a.id = $1`, [id]);

        await client.query('COMMIT');
        return sendSuccess(res, 200, misAJour.rows[0], 'Candidature mise à jour avec succès.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erreur lors de la mise à jour de la candidature:', error);
        return sendError(res, 500, 'APPLICATION_UPDATE_ERROR', 'Erreur serveur lors de la mise à jour de la candidature.');
    } finally {
        client.release();
    }
};

const deleteApplication = async (req, res) => {
    const { id } = req.params;

    try {
        // documents et interviews sont en ON DELETE CASCADE : rien à supprimer
        // manuellement, et surtout pas après le DELETE de la candidature.
        const supprimee = await pool.query('DELETE FROM applications WHERE id = $1 RETURNING id', [id]);

        if (supprimee.rows.length === 0) {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        return sendSuccess(res, 200, { id }, 'Candidature supprimée avec succès.');
    } catch (error) {
        console.error('Erreur lors de la suppression de la candidature:', error);
        return sendError(res, 500, 'APPLICATION_DELETE_ERROR', 'Erreur serveur lors de la suppression de la candidature.');
    }
};

module.exports = {
    getApplications,
    getApplication,
    createApplication,
    updateApplication,
    deleteApplication,
};
