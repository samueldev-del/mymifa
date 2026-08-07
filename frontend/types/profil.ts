export interface Profil {
  nom: string;
  titre_professionnel: string;
  /** Adresse qui figure sur les candidatures et signe les lettres. */
  email: string;
  telephone: string;
  ville: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
}

export const EMPTY_PROFIL: Profil = {
  nom: '',
  titre_professionnel: '',
  email: '',
  telephone: '',
  ville: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
};
