const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

const CHAMPS = [
    'nom',
    'titre_professionnel',
    'email',
    'telephone',
    'ville',
    'linkedin_url',
    'github_url',
    'portfolio_url',
];

const getProfil = async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, ${CHAMPS.join(', ')} FROM profil WHERE id = 1`);

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
    const affectations = CHAMPS.map((champ, index) => `${champ} = $${index + 1}`).join(', ');
    const valeurs = CHAMPS.map((champ) => req.body[champ] ?? '');

    try {
        const result = await pool.query(
            `UPDATE profil SET ${affectations} WHERE id = 1 RETURNING id, ${CHAMPS.join(', ')}`,
            valeurs
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

module.exports = { getProfil, updateProfil, CHAMPS };
