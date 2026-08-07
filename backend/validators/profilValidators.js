const { z } = require('zod');

const texte = (max) => z.string().trim().max(max).optional().default('');

const lienOptionnel = z
  .string()
  .trim()
  .url('URL invalide.')
  .optional()
  .or(z.literal(''))
  .transform((value) => value || '');

const updateProfilSchema = z.object({
  nom: texte(255),
  titre_professionnel: texte(255),
  // L'adresse figure sur les candidatures : une faute de frappe se paie cher.
  email: z
    .string()
    .trim()
    .email('Adresse email invalide.')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || ''),
  telephone: texte(64),
  ville: texte(255),
  linkedin_url: lienOptionnel,
  github_url: lienOptionnel,
  portfolio_url: lienOptionnel,
});

module.exports = { updateProfilSchema };
