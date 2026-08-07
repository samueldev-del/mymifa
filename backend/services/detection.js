/**
 * Détection du statut d'une candidature à partir d'un email.
 *
 * Deux garde-fous, appris d'un test sur une vraie boîte : sur 26 messages
 * réels — tous des notifications de job boards — une détection par mots isolés
 * classait 15 messages en « refusé » ou « accepté ». Une alerte « Neue Angebote
 * für Sie » suffisait à déclencher « accepté ».
 *
 *  1. Les expéditeurs de masse sont ignorés avant toute analyse.
 *  2. La détection s'appuie sur des tournures de phrase, pas sur des mots
 *     isolés : « leider müssen wir » plutôt que « leider ».
 *
 * Le compromis est volontairement conservateur : mieux vaut ne rien détecter
 * et laisser l'utilisateur classer à la main, que déclarer une candidature
 * refusée à tort.
 */

/** Plateformes d'emploi : elles notifient en masse, jamais en réponse à VOUS. */
const DOMAINES_IGNORES = [
    'linkedin.com',
    'indeed.com',
    'match.indeed.com',
    'freelancermap.de',
    'freelancermap.com',
    'wellfound.com',
    'hi.wellfound.com',
    'stepstone.de',
    'xing.com',
    'glassdoor.com',
    'monster.de',
    'welcometothejungle.com',
    'angel.co',
    'jobs.de',
    'meinestadt.de',
];

/** Boîtes techniques qui ne portent jamais une réponse personnelle. */
const PREFIXES_IGNORES = ['newsletter', 'noreply', 'no-reply', 'donotreply', 'mailer', 'bounce'];

/**
 * Tournures indiquant une décision. L'ordre d'évaluation compte : une lettre
 * de refus mentionne très souvent « Gespräch » ou « interview ».
 */
const MOTIFS_REFUS = [
    /leider (m[üu]ssen|k[öo]nnen|haben) wir/i,
    /eine absage/i,
    /nicht (weiter )?ber[üu]cksichtig/i,
    /f[üu]r einen anderen (kandidaten|bewerber)/i,
    /entschieden,? ihre bewerbung nicht/i,
    /unfortunately,? we/i,
    /we (have )?(decided|regret) (not )?to/i,
    /not (be )?(moving|proceeding) (forward|further)/i,
    /another candidate/i,
    /malheureusement,? nous/i,
    /ne (pas )?donn(ons|er) (pas )?suite/i,
    /votre candidature n'a pas [ée]t[ée] retenue/i,
];

const MOTIFS_ACCEPTE = [
    /arbeitsvertrag/i,
    /vertragsangebot/i,
    /freuen uns,? ihnen .{0,40}anbieten/i,
    /(hiermit )?(unsere|die) zusage/i,
    /pleased to offer you/i,
    /we would like to offer you/i,
    /offer of employment/i,
    /nous avons le plaisir de vous proposer/i,
    /promesse d'embauche/i,
];

const MOTIFS_ENTRETIEN = [
    /einladung zu(m|r)/i,
    /vorstellungsgespr[äa]ch/i,
    /kennenlerngespr[äa]ch/i,
    /zu einem gespr[äa]ch einladen/i,
    /terminvorschlag/i,
    /invite you (to|for) (an? )?(interview|call|chat)/i,
    /schedule (an? )?(interview|call)/i,
    /next steps? in (the|our) (interview|hiring) process/i,
    /convier? [àa] un entretien/i,
    /proposer un entretien/i,
];

/** @returns {boolean} true si l'expéditeur ne peut pas porter une réponse. */
const expediteurIgnore = (adresse) => {
    const email = (adresse || '').toLowerCase();
    if (!email.includes('@')) return true;

    const [locale, domaine] = email.split('@');

    if (PREFIXES_IGNORES.some((prefixe) => locale.startsWith(prefixe))) return true;

    // Compare aussi les sous-domaines : jobs.linkedin.com doit être exclu.
    return DOMAINES_IGNORES.some((ignore) => domaine === ignore || domaine.endsWith(`.${ignore}`));
};

const correspond = (motifs, texte) => motifs.some((motif) => motif.test(texte));

/**
 * @param {string} texte  sujet et corps concaténés
 * @returns {'refuse'|'accepte'|'entretien'|null}
 */
const detecterStatut = (texte) => {
    const contenu = texte || '';
    if (correspond(MOTIFS_REFUS, contenu)) return 'refuse';
    if (correspond(MOTIFS_ACCEPTE, contenu)) return 'accepte';
    if (correspond(MOTIFS_ENTRETIEN, contenu)) return 'entretien';
    return null;
};

module.exports = { detecterStatut, expediteurIgnore, DOMAINES_IGNORES };
