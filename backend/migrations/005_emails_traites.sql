-- Journal des messages déjà traités par la synchronisation IMAP.
--
-- Choix volontaire : ne PAS marquer les messages comme lus dans la boîte.
-- L'application lit une messagerie personnelle ; en changer l'état de lecture
-- serait intrusif et rendrait le suivi dépendant d'un drapeau que
-- l'utilisateur peut modifier depuis son client mail.
-- On mémorise donc ici les Message-ID déjà vus.
CREATE TABLE IF NOT EXISTS emails_traites (
    message_id      VARCHAR(998) PRIMARY KEY,
    expediteur      VARCHAR(320),
    sujet           VARCHAR(512),
    statut_detecte  VARCHAR(32),
    application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
    recu_le         TIMESTAMPTZ,
    traite_le       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emails_traites_le ON emails_traites (traite_le DESC);
