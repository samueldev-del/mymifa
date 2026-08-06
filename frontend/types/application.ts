/**
 * Statuts de l'ENUM PostgreSQL `application_status`.
 * Toute valeur hors de cette liste est rejetée par la base.
 */
export const STATUT_VALUES = ['brouillon', 'envoye', 'entretien', 'refuse', 'accepte'] as const;

export type Statut = (typeof STATUT_VALUES)[number];

/** Libellés affichés et couleurs associées à chaque statut. */
export const STATUT_META: Record<Statut, { label: string; badge: string; dot: string }> = {
  brouillon: {
    label: 'À finaliser',
    badge: 'bg-littoral-light/25 text-littoral-dark',
    dot: 'bg-littoral-light',
  },
  envoye: {
    label: 'Envoyée',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  entretien: {
    label: 'Entretien',
    badge: 'bg-amber-100 text-amber-900',
    dot: 'bg-amber-500',
  },
  accepte: {
    label: 'Acceptée',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
  refuse: {
    label: 'Refusée',
    badge: 'bg-laterite/15 text-laterite',
    dot: 'bg-laterite',
  },
};

/** Colonnes du Kanban, dans l'ordre d'affichage. */
export const KANBAN_COLUMNS: { title: string; statuts: Statut[] }[] = [
  { title: 'À finaliser', statuts: ['brouillon'] },
  { title: 'En attente', statuts: ['envoye'] },
  { title: 'Entretiens', statuts: ['entretien'] },
  { title: 'Historique', statuts: ['accepte', 'refuse'] },
];

export interface Application {
  id: string;
  titre_poste: string;
  entreprise_nom: string;
  statut: Statut;
  description_offre?: string | null;
  url_offre?: string | null;
  notes?: string | null;
  ats_score?: number | null;
  date_envoi?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Champs modifiables via PUT /applications/:id. */
export interface ApplicationUpdatePayload {
  titre_poste?: string;
  nom_entreprise?: string;
  url_offre?: string;
  description_offre?: string;
  notes?: string;
  statut?: Statut;
}
