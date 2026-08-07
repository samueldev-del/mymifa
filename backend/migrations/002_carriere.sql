-- Modules de gestion de carrière : formations, contacts, relances et
-- préparation d'entretiens.
--
-- Choix volontaire : VARCHAR + CHECK plutôt que des ENUM PostgreSQL.
-- Les ENUM existants (application_status, document_type) ont déjà provoqué des
-- 500 quand le code s'en est écarté, et les faire évoluer demande un ALTER TYPE.
-- Un CHECK se modifie par une simple migration.

-- ---------------------------------------------------------------- formations
CREATE TABLE IF NOT EXISTS formations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre           VARCHAR(255) NOT NULL,
    organisme       VARCHAR(255),
    statut          VARCHAR(32) NOT NULL DEFAULT 'prevue'
                    CHECK (statut IN ('prevue', 'en_cours', 'terminee', 'abandonnee')),
    date_debut      DATE,
    date_fin        DATE,
    url             VARCHAR(1024),
    -- Compétences visées : sert à relier les formations aux lacunes ATS.
    competences     TEXT[] NOT NULL DEFAULT '{}',
    notes           TEXT,
    certificat_id   UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formations_statut ON formations (statut, date_fin DESC);

-- ------------------------------------------------------------------ contacts
CREATE TABLE IF NOT EXISTS contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
    application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
    nom             VARCHAR(255) NOT NULL,
    role            VARCHAR(255),
    email           VARCHAR(255),
    telephone       VARCHAR(64),
    linkedin_url    VARCHAR(1024),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_application ON contacts (application_id);

-- ------------------------------------------------------------------ relances
-- Transforme une note « relancer sous 10 jours » en échéance suivie.
CREATE TABLE IF NOT EXISTS relances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    libelle         VARCHAR(255) NOT NULL,
    echeance        DATE NOT NULL,
    fait            BOOLEAN NOT NULL DEFAULT FALSE,
    fait_le         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relances_echeance ON relances (fait, echeance);

-- ---------------------------------------------------- entretiens (existante)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS type_entretien VARCHAR(32)
    NOT NULL DEFAULT 'rh'
    CHECK (type_entretien IN ('rh', 'technique', 'manager', 'final', 'autre'));
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS modalite VARCHAR(32)
    NOT NULL DEFAULT 'visio'
    CHECK (modalite IN ('visio', 'telephone', 'sur_site'));
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS lieu VARCHAR(512);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS contact_id UUID
    REFERENCES contacts(id) ON DELETE SET NULL;
-- Réponses préparées au format STAR, et questions à poser au recruteur.
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS reponses_star JSONB;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS questions_a_poser JSONB;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS bilan TEXT;

CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews (date_entretien);

-- --------------------------------------------------------- déclencheurs MAJ
DROP TRIGGER IF EXISTS trg_formations_updated_at ON formations;
CREATE TRIGGER trg_formations_updated_at
    BEFORE UPDATE ON formations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_interviews_updated_at ON interviews;
CREATE TRIGGER trg_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
