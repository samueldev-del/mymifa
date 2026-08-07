const pool = require('../config/db');
const { sendSuccess, sendError } = require('../utils/http');

const SELECT_CONTACT = `
    SELECT ct.id, ct.company_id, ct.application_id, ct.nom, ct.role, ct.email,
           ct.telephone, ct.linkedin_url, ct.notes, ct.created_at, ct.updated_at,
           c.nom AS entreprise_nom,
           a.titre_poste
    FROM contacts ct
    LEFT JOIN companies c ON ct.company_id = c.id
    LEFT JOIN applications a ON ct.application_id = a.id
`;

/** Résout l'entreprise depuis la candidature quand elle n'est pas fournie. */
const resoudreCompany = async (client, { company_id, application_id }) => {
    if (company_id) return company_id;
    if (!application_id) return null;

    const app = await client.query('SELECT company_id FROM applications WHERE id = $1', [application_id]);
    return app.rows[0]?.company_id ?? null;
};

const listContacts = async (req, res) => {
    const { applicationId } = req.query;

    try {
        const result = applicationId
            ? await pool.query(
                  `${SELECT_CONTACT} WHERE ct.application_id = $1 ORDER BY ct.created_at DESC`,
                  [applicationId]
              )
            : await pool.query(`${SELECT_CONTACT} ORDER BY ct.created_at DESC`);

        return sendSuccess(res, 200, result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des contacts:', error);
        return sendError(res, 500, 'CONTACT_LIST_ERROR', 'Erreur lors de la récupération des contacts.');
    }
};

const createContact = async (req, res) => {
    const { nom, role, email, telephone, linkedin_url, notes, application_id } = req.body;

    try {
        const companyId = await resoudreCompany(pool, req.body);

        const creee = await pool.query(
            `INSERT INTO contacts (company_id, application_id, nom, role, email, telephone, linkedin_url, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
                companyId,
                application_id || null,
                nom,
                role || null,
                email || null,
                telephone || null,
                linkedin_url || null,
                notes || null,
            ]
        );

        const complet = await pool.query(`${SELECT_CONTACT} WHERE ct.id = $1`, [creee.rows[0].id]);
        return sendSuccess(res, 201, complet.rows[0], 'Contact ajouté.');
    } catch (error) {
        console.error('Erreur lors de la création du contact:', error);
        return sendError(res, 500, 'CONTACT_CREATE_ERROR', 'Erreur lors de la création du contact.');
    }
};

const updateContact = async (req, res) => {
    const { id } = req.params;
    const champsAutorises = ['nom', 'role', 'email', 'telephone', 'linkedin_url', 'notes', 'application_id'];

    const champs = [];
    const valeurs = [];
    let index = 1;

    for (const champ of champsAutorises) {
        if (req.body[champ] === undefined) continue;
        champs.push(`${champ} = $${index++}`);
        valeurs.push(req.body[champ] || null);
    }

    if (champs.length === 0) {
        return sendError(res, 400, 'CONTACT_UPDATE_EMPTY', 'Aucun changement à appliquer.');
    }

    valeurs.push(id);

    try {
        const misAJour = await pool.query(
            `UPDATE contacts SET ${champs.join(', ')} WHERE id = $${index} RETURNING id`,
            valeurs
        );

        if (misAJour.rows.length === 0) {
            return sendError(res, 404, 'CONTACT_NOT_FOUND', 'Contact introuvable.');
        }

        const complet = await pool.query(`${SELECT_CONTACT} WHERE ct.id = $1`, [id]);
        return sendSuccess(res, 200, complet.rows[0], 'Contact mis à jour.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du contact:', error);
        return sendError(res, 500, 'CONTACT_UPDATE_ERROR', 'Erreur lors de la mise à jour du contact.');
    }
};

const deleteContact = async (req, res) => {
    try {
        const supprime = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [req.params.id]);

        if (supprime.rows.length === 0) {
            return sendError(res, 404, 'CONTACT_NOT_FOUND', 'Contact introuvable.');
        }

        return sendSuccess(res, 200, { id: req.params.id }, 'Contact supprimé.');
    } catch (error) {
        console.error('Erreur lors de la suppression du contact:', error);
        return sendError(res, 500, 'CONTACT_DELETE_ERROR', 'Erreur lors de la suppression du contact.');
    }
};

// ------------------------------------------------------------------ relances

const SELECT_RELANCE = `
    SELECT r.id, r.application_id, r.libelle, r.echeance, r.fait, r.fait_le, r.created_at,
           a.titre_poste, c.nom AS entreprise_nom
    FROM relances r
    JOIN applications a ON r.application_id = a.id
    LEFT JOIN companies c ON a.company_id = c.id
`;

const listRelances = async (req, res) => {
    const { applicationId, enAttente } = req.query;

    const conditions = [];
    const valeurs = [];

    if (applicationId) {
        valeurs.push(applicationId);
        conditions.push(`r.application_id = $${valeurs.length}`);
    }

    if (enAttente === 'true') conditions.push('r.fait = FALSE');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const result = await pool.query(
            `${SELECT_RELANCE} ${where} ORDER BY r.fait ASC, r.echeance ASC`,
            valeurs
        );
        return sendSuccess(res, 200, result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des relances:', error);
        return sendError(res, 500, 'RELANCE_LIST_ERROR', 'Erreur lors de la récupération des relances.');
    }
};

const createRelance = async (req, res) => {
    const { application_id, libelle, echeance } = req.body;

    try {
        const creee = await pool.query(
            `INSERT INTO relances (application_id, libelle, echeance)
             VALUES ($1, $2, $3) RETURNING id`,
            [application_id, libelle, echeance]
        );

        const complete = await pool.query(`${SELECT_RELANCE} WHERE r.id = $1`, [creee.rows[0].id]);
        return sendSuccess(res, 201, complete.rows[0], 'Relance planifiée.');
    } catch (error) {
        if (error.code === '23503') {
            return sendError(res, 404, 'APPLICATION_NOT_FOUND', 'Candidature introuvable.');
        }
        console.error('Erreur lors de la création de la relance:', error);
        return sendError(res, 500, 'RELANCE_CREATE_ERROR', 'Erreur lors de la création de la relance.');
    }
};

const toggleRelance = async (req, res) => {
    const { id } = req.params;
    const { fait } = req.body;

    try {
        const misAJour = await pool.query(
            `UPDATE relances SET fait = $1, fait_le = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id = $2 RETURNING id`,
            [fait, id]
        );

        if (misAJour.rows.length === 0) {
            return sendError(res, 404, 'RELANCE_NOT_FOUND', 'Relance introuvable.');
        }

        const complete = await pool.query(`${SELECT_RELANCE} WHERE r.id = $1`, [id]);
        return sendSuccess(res, 200, complete.rows[0], fait ? 'Relance faite.' : 'Relance réouverte.');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la relance:', error);
        return sendError(res, 500, 'RELANCE_UPDATE_ERROR', 'Erreur lors de la mise à jour de la relance.');
    }
};

const deleteRelance = async (req, res) => {
    try {
        const supprimee = await pool.query('DELETE FROM relances WHERE id = $1 RETURNING id', [
            req.params.id,
        ]);

        if (supprimee.rows.length === 0) {
            return sendError(res, 404, 'RELANCE_NOT_FOUND', 'Relance introuvable.');
        }

        return sendSuccess(res, 200, { id: req.params.id }, 'Relance supprimée.');
    } catch (error) {
        console.error('Erreur lors de la suppression de la relance:', error);
        return sendError(res, 500, 'RELANCE_DELETE_ERROR', 'Erreur lors de la suppression de la relance.');
    }
};

module.exports = {
    listContacts,
    createContact,
    updateContact,
    deleteContact,
    listRelances,
    createRelance,
    toggleRelance,
    deleteRelance,
};
