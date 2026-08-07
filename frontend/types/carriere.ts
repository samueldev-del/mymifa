export const FORMATION_STATUTS = ['prevue', 'en_cours', 'terminee', 'abandonnee'] as const;
export type FormationStatut = (typeof FORMATION_STATUTS)[number];

export const FORMATION_STATUT_STYLE: Record<FormationStatut, string> = {
  prevue: 'bg-blue-100 text-blue-800',
  en_cours: 'bg-amber-100 text-amber-900',
  terminee: 'bg-emerald-100 text-emerald-800',
  abandonnee: 'bg-littoral-light/25 text-littoral-dark/70',
};

export interface Formation {
  id: string;
  titre: string;
  organisme: string | null;
  statut: FormationStatut;
  date_debut: string | null;
  date_fin: string | null;
  url: string | null;
  competences: string[];
  notes: string | null;
  certificat_id: string | null;
  certificat_libelle: string | null;
  created_at: string;
}

export const INTERVIEW_TYPES = ['rh', 'technique', 'manager', 'final', 'autre'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_MODALITES = ['visio', 'telephone', 'sur_site'] as const;
export type InterviewModalite = (typeof INTERVIEW_MODALITES)[number];

export interface ReponseStar {
  question: string;
  situation?: string;
  tache?: string;
  action?: string;
  resultat?: string;
}

export const QUESTION_CATEGORIES = [
  'technique',
  'experience',
  'comportementale',
  'motivation',
  'salaire',
] as const;
export type QuestionCategorie = (typeof QUESTION_CATEGORIES)[number];

export const CATEGORIE_STYLE: Record<QuestionCategorie, string> = {
  technique: 'bg-blue-100 text-blue-800',
  experience: 'bg-emerald-100 text-emerald-800',
  comportementale: 'bg-amber-100 text-amber-900',
  motivation: 'bg-littoral-light/30 text-littoral-dark',
  salaire: 'bg-laterite/15 text-laterite',
};

export interface QuestionPrepa {
  question: string;
  categorie: QuestionCategorie;
  pourquoi: string;
  piste_reponse: string;
}

/** Dossier de préparation généré par Claude. */
export interface PreparationIA {
  questions: QuestionPrepa[];
  questions_a_poser: string[];
  points_de_vigilance: string[];
  fiche_entreprise: string;
}

export interface Interview {
  id: string;
  application_id: string;
  date_entretien: string;
  type_entretien: InterviewType;
  modalite: InterviewModalite;
  lieu: string | null;
  contact_id: string | null;
  contact_nom: string | null;
  notes_prepa: string | null;
  questions_ia: PreparationIA | null;
  reponses_star: ReponseStar[] | null;
  questions_a_poser: string[] | null;
  bilan: string | null;
  titre_poste: string;
  description_offre: string | null;
  entreprise_nom: string | null;
}

export interface Contact {
  id: string;
  company_id: string | null;
  application_id: string | null;
  nom: string;
  role: string | null;
  email: string | null;
  telephone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  entreprise_nom: string | null;
  titre_poste: string | null;
  created_at: string;
}

export interface Relance {
  id: string;
  application_id: string;
  libelle: string;
  echeance: string;
  fait: boolean;
  fait_le: string | null;
  titre_poste: string;
  entreprise_nom: string | null;
  en_retard?: boolean;
}

export interface Lacune {
  mot_cle: string;
  occurrences: number;
  poids: number;
  importance_max: 'critique' | 'importante' | 'secondaire';
  couverte: boolean;
}

/** Charge utile de GET /dashboard : tout ce qu'affiche l'accueil, en un appel. */
export interface DashboardData {
  candidatures: {
    total: number;
    actives: number;
    envoyees: number;
    par_statut: Record<string, number>;
    score_ats_moyen: number | null;
    taux_entretien: number | null;
  };
  entretiens_a_venir: {
    id: string;
    date_entretien: string;
    type_entretien: InterviewType;
    modalite: InterviewModalite;
    lieu: string | null;
    prepare: boolean;
    application_id: string;
    titre_poste: string;
    entreprise_nom: string | null;
  }[];
  relances_en_attente: {
    id: string;
    libelle: string;
    echeance: string;
    application_id: string;
    titre_poste: string;
    entreprise_nom: string | null;
    en_retard: boolean;
  }[];
  formations: {
    par_statut: Record<string, number>;
    total: number;
  };
  lacunes: Lacune[];
}
