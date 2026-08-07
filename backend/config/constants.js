/**
 * Source de vérité unique des valeurs contraintes.
 *
 * STATUTS et DOCUMENT_TYPES reflètent des ENUM PostgreSQL : toute divergence
 * provoque un 500 côté base.
 * Les autres reflètent des contraintes CHECK, plus faciles à faire évoluer.
 */
const STATUTS = ['brouillon', 'envoye', 'entretien', 'refuse', 'accepte'];

const DOCUMENT_TYPES = ['cv', 'lettre_motivation', 'autre'];

/** Statuts terminaux : candidature close. */
const STATUTS_CLOTURES = ['refuse', 'accepte'];

/** Statuts actifs : la candidature est encore en jeu. */
const STATUTS_ACTIFS = ['envoye', 'entretien'];

const FORMATION_STATUTS = ['prevue', 'en_cours', 'terminee', 'abandonnee'];

const INTERVIEW_TYPES = ['rh', 'technique', 'manager', 'final', 'autre'];

const INTERVIEW_MODALITES = ['visio', 'telephone', 'sur_site'];

module.exports = {
    STATUTS,
    STATUTS_CLOTURES,
    STATUTS_ACTIFS,
    DOCUMENT_TYPES,
    FORMATION_STATUTS,
    INTERVIEW_TYPES,
    INTERVIEW_MODALITES,
};
