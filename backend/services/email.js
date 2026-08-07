const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

/**
 * Lecture IMAP de la boîte du candidat.
 *
 * Pourquoi IMAP plutôt qu'un webhook entrant : les MX du domaine sont chez
 * l'hébergeur mail, qui ne sait pas appeler une URL. Passer par un service de
 * parsing entrant imposerait de détourner les MX vers un tiers — risqué pour
 * une boîte personnelle. Ici, on se connecte en lecture seule et on ne modifie
 * rien : ni drapeau « lu », ni déplacement, ni suppression.
 */
const FENETRE_JOURS = 14;

const config = () => ({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASSWORD,
    },
    logger: false,
});

const estConfigure = () =>
    Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);

/**
 * Récupère les messages reçus dans la fenêtre récente.
 * @returns {Promise<Array<{messageId, from, subject, text, date}>>}
 */
const lireMessagesRecents = async (limite = 40) => {
    const client = new ImapFlow(config());
    const messages = [];

    await client.connect();

    try {
        // readOnly : garantit qu'aucun drapeau n'est modifié côté serveur.
        const verrou = await client.getMailboxLock('INBOX', { readOnly: true });

        try {
            const depuis = new Date(Date.now() - FENETRE_JOURS * 24 * 60 * 60 * 1000);
            const uids = await client.search({ since: depuis }, { uid: true });

            if (!uids || uids.length === 0) return [];

            // Les plus récents d'abord, plafonnés : une boîte chargée ne doit
            // pas faire exploser la durée de la fonction.
            const selection = uids.slice(-limite);

            for await (const message of client.fetch(
                selection,
                { source: true, envelope: true },
                { uid: true }
            )) {
                const parsed = await simpleParser(message.source);

                messages.push({
                    messageId: parsed.messageId || `uid-${message.uid}`,
                    from: parsed.from?.value?.[0]?.address || '',
                    fromName: parsed.from?.value?.[0]?.name || '',
                    subject: parsed.subject || '',
                    text: parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '',
                    date: parsed.date || null,
                });
            }
        } finally {
            verrou.release();
        }
    } finally {
        await client.logout().catch(() => {});
    }

    return messages;
};

module.exports = { lireMessagesRecents, estConfigure, FENETRE_JOURS };
