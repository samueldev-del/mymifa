const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

const getProfil = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM profil WHERE id = 1');

        if (result.rows.length === 0) {
            return sendError(res, 404, 'PROFIL_NOT_FOUND', 'Profil introuvable.');
        }

        return sendSuccess(res, 200, result.rows[0]);
    } catch (error) {
        console.error('Erreur getProfil:', error);
        return sendError(res, 500, 'PROFIL_FETCH_ERROR', 'Erreur serveur lors de la récupération du profil.');
    }
};

const updateProfil = async (req, res) => {
    const { nom, titre_professionnel, linkedin_url, github_url, portfolio_url } = req.body;

    try {
        const result = await pool.query(
            `UPDATE profil
             SET nom = $1, titre_professionnel = $2, linkedin_url = $3, github_url = $4, portfolio_url = $5
             WHERE id = 1
             RETURNING *`,
            [nom, titre_professionnel, linkedin_url, github_url, portfolio_url]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'PROFIL_NOT_FOUND', 'Profil introuvable.');
        }

        return sendSuccess(res, 200, result.rows[0], 'Profil mis à jour avec succès.');
    } catch (error) {
        console.error('Erreur updateProfil:', error);
        return sendError(res, 500, 'PROFIL_UPDATE_ERROR', 'Erreur serveur lors de la mise à jour du profil.');
    }
};

module.exports = { getProfil, updateProfil };
