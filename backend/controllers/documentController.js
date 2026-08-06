const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');
const {
    construireUpload,
    genererUrlSignee,
    supprimerObjet,
    cleDepuisUrl,
} = require('../services/s3');

const upload = construireUpload('candidatures');

/** Ajoute une URL signée temporaire à chaque document. */
const avecUrlsSignees = (documents) =>
    Promise.all(
        documents.map(async (doc) => {
            const cle = doc.cle_s3 || cleDepuisUrl(doc.url_fichier);
            return {
                ...doc,
                nom_fichier: doc.libelle || (cle ? cle.split('/').pop() : 'document'),
                url_telechargement: await genererUrlSignee(cle, doc.libelle),
            };
        })
    );

const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'DOCUMENT_FILE_REQUIRED', 'Aucun fichier n\'a été fourni.');
        }

        const { application_id, type_document, libelle } = req.body;

        const existe = await pool.query('SELECT id FROM applications WHERE id = $1', [application_id]);
        if (existe.rows.length === 0) {
            await supprimerObjet(req.file.key);
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }

        const nouveau = await pool.query(
            `INSERT INTO documents (application_id, type_document, url_fichier, cle_s3, libelle)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [
                application_id,
                type_document || 'autre',
                req.file.location,
                req.file.key,
                libelle || req.file.originalname,
            ]
        );

        const [document] = await avecUrlsSignees(nouveau.rows);
        return sendSuccess(res, 201, document, 'Document téléversé avec succès.');
    } catch (error) {
        // Le fichier est déjà sur S3 quand l'insertion échoue : on nettoie.
        if (req.file?.key) {
            await supprimerObjet(req.file.key).catch(() => {});
        }
        console.error('Erreur lors du téléversement S3:', error);
        return sendError(res, 500, 'DOCUMENT_UPLOAD_ERROR', 'Erreur lors du téléversement du document.');
    }
};

const getDocumentsByApplication = async (req, res) => {
    const { applicationId } = req.params;

    try {
        const result = await pool.query(
            `SELECT id, application_id, type_document, url_fichier, cle_s3, libelle, created_at
             FROM documents
             WHERE application_id = $1
             ORDER BY created_at DESC, id DESC`,
            [applicationId]
        );

        return sendSuccess(res, 200, await avecUrlsSignees(result.rows));
    } catch (error) {
        console.error('Erreur lors de la récupération des documents:', error);
        return sendError(res, 500, 'DOCUMENT_LIST_ERROR', 'Erreur lors de la récupération des documents.');
    }
};

const deleteDocument = async (req, res) => {
    const { id } = req.params;

    try {
        const supprime = await pool.query(
            'DELETE FROM documents WHERE id = $1 RETURNING id, cle_s3, url_fichier',
            [id]
        );

        if (supprime.rows.length === 0) {
            return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
        }

        const { cle_s3, url_fichier } = supprime.rows[0];
        // L'objet S3 est secondaire : la ligne est déjà supprimée en base.
        await supprimerObjet(cle_s3 || cleDepuisUrl(url_fichier)).catch((error) => {
            console.error('Objet S3 non supprimé:', error.message);
        });

        return sendSuccess(res, 200, { id }, 'Document supprimé.');
    } catch (error) {
        console.error('Erreur lors de la suppression du document:', error);
        return sendError(res, 500, 'DOCUMENT_DELETE_ERROR', 'Erreur lors de la suppression du document.');
    }
};

module.exports = {
    upload,
    uploadDocument,
    getDocumentsByApplication,
    deleteDocument,
    avecUrlsSignees,
};
