/** ENUM PostgreSQL `document_type` — 'portfolio' n'existe pas en base. */
export const DOCUMENT_TYPES = ['cv', 'lettre_motivation', 'autre'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: 'CV',
  lettre_motivation: 'Lettre de motivation',
  autre: 'Autre',
};

export interface DocumentItem {
  id: string;
  application_id: string | null;
  type_document: DocumentType;
  url_fichier: string;
  libelle?: string | null;
  /** Nom lisible calculé côté backend. */
  nom_fichier?: string;
  /** URL S3 signée, valable 15 minutes. */
  url_telechargement: string | null;
  created_at?: string;
}

/** Un CV de la bibliothèque : un document sans candidature rattachée. */
export type CvItem = DocumentItem;
