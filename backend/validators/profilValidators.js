const { z } = require('zod');

const lienOptionnel = z
  .string()
  .trim()
  .url('URL invalide.')
  .optional()
  .or(z.literal(''))
  .transform((value) => value || '');

const updateProfilSchema = z.object({
  nom: z.string().trim().max(255).optional().default(''),
  titre_professionnel: z.string().trim().max(255).optional().default(''),
  linkedin_url: lienOptionnel,
  github_url: lienOptionnel,
  portfolio_url: lienOptionnel,
});

module.exports = { updateProfilSchema };
