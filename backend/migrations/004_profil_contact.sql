-- Coordonnées du candidat.
--
-- Le profil ne portait que le nom, le titre et les liens publics : l'adresse
-- email qui figure sur les candidatures n'avait aucun endroit où être stockée,
-- et la génération de lettre ignorait donc à qui elle appartenait.
ALTER TABLE profil ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE profil ADD COLUMN IF NOT EXISTS telephone VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE profil ADD COLUMN IF NOT EXISTS ville VARCHAR(255) NOT NULL DEFAULT '';
