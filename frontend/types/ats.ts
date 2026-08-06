export type ImportanceMotCle = 'critique' | 'importante' | 'secondaire';

export interface MotCleManquant {
  mot_cle: string;
  importance: ImportanceMotCle;
}

export interface AtsAnalyse {
  /** Score de compatibilité 0-100. */
  score: number;
  synthese: string;
  mots_cles_manquants: MotCleManquant[];
  points_forts: string[];
  recommandations: string[];
  document_id: string;
  document_libelle?: string | null;
  /** Présent uniquement sur une analyse relue depuis la base. */
  analyse_le?: string | null;
}

export const IMPORTANCE_META: Record<ImportanceMotCle, { label: string; className: string }> = {
  critique: { label: 'Critique', className: 'bg-laterite/15 text-laterite border-laterite/30' },
  importante: { label: 'Important', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  secondaire: {
    label: 'Secondaire',
    className: 'bg-littoral-light/20 text-littoral-dark border-littoral-light/40',
  },
};
