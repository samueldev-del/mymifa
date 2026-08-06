/**
 * Source de vérité unique, alignée sur les ENUM PostgreSQL.
 * Toute divergence ici provoque un 500 côté base (valeur d'enum invalide).
 *
 *   application_status : brouillon | envoye | entretien | refuse | accepte
 *   document_type      : cv | lettre_motivation | autre
 */
const STATUTS = ['brouillon', 'envoye', 'entretien', 'refuse', 'accepte'];

const DOCUMENT_TYPES = ['cv', 'lettre_motivation', 'autre'];

/** Statuts considérés comme terminaux (candidature close). */
const STATUTS_CLOTURES = ['refuse', 'accepte'];

module.exports = {
    STATUTS,
    DOCUMENT_TYPES,
    STATUTS_CLOTURES,
};
