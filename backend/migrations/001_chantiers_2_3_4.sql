-- Migration idempotente pour les chantiers 2 (bibliothèque de CV),
-- 3 (super-modale : notes + analyse ATS) et 4 (sécurité).
-- Exécuter avec : npm run migrate

-- Chantier 3 : notes personnelles sur une candidature.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes TEXT;

-- Chantier 3 : résultat complet de l'analyse ATS.
-- ats_score (0-100) existe déjà ; on stocke ici les mots-clés manquants,
-- la synthèse et le document analysé.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ats_analyse JSONB;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ats_analyse_at TIMESTAMPTZ;

-- Chantier 2 : libellé lisible d'un document ("CV Français", "CV Anglais"...).
-- La bibliothèque de CV = documents dont application_id IS NULL.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS libelle VARCHAR(255);

-- La clé S3 est nécessaire pour générer des URLs signées (les fichiers ne sont
-- plus publics). Rempli pour les nouveaux uploads.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS cle_s3 VARCHAR(1024);

-- Index sur la bibliothèque de CV (documents non rattachés à une candidature).
CREATE INDEX IF NOT EXISTS idx_documents_bibliotheque
    ON documents (created_at DESC)
    WHERE application_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_application
    ON documents (application_id);

-- updated_at n'était jamais mis à jour : on le fait via un trigger plutôt que
-- de dépendre de chaque requête UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
