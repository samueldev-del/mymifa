const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');
const { construireUpload, supprimerObjet, cleDepuisUrl } = require('../services/s3');
const { avecUrlsSignees } = require('./documentController');

/**
 * Bibliothèque de CV = documents de type 'cv' non rattachés à une candidature
 * (application_id IS NULL). Pas de table dédiée : la colonne est déjà nullable.
 */
const upload = construireUpload('bibliotheque');

const listCvs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, type_document, url_fichier, cle_s3, libelle, created_at
             FROM documents
             WHERE application_id IS NULL
             ORDER BY created_at DESC, id DESC`
        );

        return sendSuccess(res, 200, await avecUrlsSignees(result.rows));
    } catch (error) {
        console.error('Erreur lors de la récupération de la bibliothèque:', error);
        return sendError(res, 500, 'CV_LIST_ERROR', 'Erreur lors de la récupération de la bibliothèque de CV.');
    }
};

const uploadCv = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'CV_FILE_REQUIRED', 'Aucun fichier n\'a été fourni.');
        }

        const libelle = (req.body.libelle || '').trim() || req.file.originalname;

        const nouveau = await pool.query(
            `INSERT INTO documents (application_id, type_document, url_fichier, cle_s3, libelle)
             VALUES (NULL, 'cv', $1, $2, $3) RETURNING *`,
            [req.file.location, req.file.key, libelle]
        );

        const [cv] = await avecUrlsSignees(nouveau.rows);
        return sendSuccess(res, 201, cv, 'CV ajouté à la bibliothèque.');
    } catch (error) {
        if (req.file?.key) {
            await supprimerObjet(req.file.key).catch(() => {});
        }
        console.error('Erreur lors de l\'ajout du CV:', error);
        return sendError(res, 500, 'CV_UPLOAD_ERROR', 'Erreur lors de l\'ajout du CV.');
    }
};

const renameCv = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `UPDATE documents SET libelle = $1
             WHERE id = $2 AND application_id IS NULL
             RETURNING id, type_document, url_fichier, cle_s3, libelle, created_at`,
            [req.body.libelle.trim(), id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'CV_NOT_FOUND', 'CV introuvable dans la bibliothèque.');
        }

        const [cv] = await avecUrlsSignees(result.rows);
        return sendSuccess(res, 200, cv, 'CV renommé.');
    } catch (error) {
        console.error('Erreur lors du renommage du CV:', error);
        return sendError(res, 500, 'CV_RENAME_ERROR', 'Erreur lors du renommage du CV.');
    }
};

const deleteCv = async (req, res) => {
    const { id } = req.params;

    try {
        const supprime = await pool.query(
            `DELETE FROM documents
             WHERE id = $1 AND application_id IS NULL
             RETURNING id, cle_s3, url_fichier`,
            [id]
        );

        if (supprime.rows.length === 0) {
            return sendError(res, 404, 'CV_NOT_FOUND', 'CV introuvable dans la bibliothèque.');
        }

        const { cle_s3, url_fichier } = supprime.rows[0];
        await supprimerObjet(cle_s3 || cleDepuisUrl(url_fichier)).catch((error) => {
            console.error('Objet S3 non supprimé:', error.message);
        });

        return sendSuccess(res, 200, { id }, 'CV supprimé de la bibliothèque.');
    } catch (error) {
        console.error('Erreur lors de la suppression du CV:', error);
        return sendError(res, 500, 'CV_DELETE_ERROR', 'Erreur lors de la suppression du CV.');
    }
};

module.exports = { upload, listCvs, uploadCv, renameCv, deleteCv };
