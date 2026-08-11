/**
 * Identité de l'éditeur, reprise par /impressum et /datenschutz.
 *
 * À COMPLÉTER avant toute mise en ligne publique : le §5 DDG impose une
 * adresse postale réelle et joignable — une boîte postale ne suffit pas.
 * Le dépôt est privé, ces données n'y sont donc pas exposées publiquement.
 */
export const EDITEUR = {
  nom: 'Samuel Djommou Thengho',
  rue: 'Bergwiesen 8',
  codePostalVille: '73312 Geislingen',
  pays: 'Deutschland',
  email: 'contact@samueldt.com',
  telephone: '', // facultatif, mais une seconde voie de contact est attendue
} as const;

/** Vrai tant que l'Impressum n'est pas exploitable, pour l'avertir en clair. */
export const EDITEUR_INCOMPLET = !EDITEUR.rue || !EDITEUR.codePostalVille;

/**
 * Sous-traitants au sens de l'art. 28 RGPD, tels qu'effectivement appelés par
 * le code. Toute nouvelle intégration doit être ajoutée ici.
 */
export const SOUS_TRAITANTS = [
  { nom: 'Vercel Inc.', role: 'Hosting (Frontend + API)', lieu: 'USA / Region fra1 (Frankfurt)' },
  { nom: 'Neon Inc.', role: 'PostgreSQL-Datenbank', lieu: 'EU (eu-central-1, Frankfurt)' },
  { nom: 'Amazon Web Services', role: 'Dokumentenspeicher (S3)', lieu: 'EU (eu-central-1, Frankfurt)' },
  { nom: 'Anthropic PBC', role: 'KI-Analyse von Lebenslauf und Anschreiben', lieu: 'USA' },
  { nom: 'Hostinger International', role: 'Domain und E-Mail-Postfach', lieu: 'EU (Litauen)' },
] as const;
