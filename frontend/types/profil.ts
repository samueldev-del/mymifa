export interface Profil {
  nom: string;
  titre_professionnel: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
}

export const EMPTY_PROFIL: Profil = {
  nom: '',
  titre_professionnel: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
};
