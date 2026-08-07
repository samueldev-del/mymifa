-- questions_ia était en TEXT mais reçoit désormais un dossier de préparation
-- structuré. En JSONB, il est requêtable et revient parsé côté Node plutôt que
-- sous forme de chaîne à re-parser dans chaque lecture.
ALTER TABLE interviews
    ALTER COLUMN questions_ia TYPE JSONB
    USING CASE
        WHEN questions_ia IS NULL OR questions_ia = '' THEN NULL
        ELSE to_jsonb(questions_ia)
    END;
