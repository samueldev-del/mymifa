const { z } = require('zod');
const { STATUTS } = require('../config/constants');

const urlOptionnelle = z
  .string()
  .trim()
  .url('URL d\'offre invalide.')
  .optional()
  .or(z.literal(''));

const createApplicationSchema = z.object({
  nom_entreprise: z.string().trim().min(1, 'Le nom de l\'entreprise est requis.'),
  titre_poste: z.string().trim().min(1, 'Le titre du poste est requis.'),
  url_offre: urlOptionnelle,
  description_offre: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const updateApplicationSchema = z
  .object({
    nom_entreprise: z.string().trim().min(1).optional(),
    titre_poste: z.string().trim().min(1).optional(),
    url_offre: urlOptionnelle,
    description_offre: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    statut: z
      .enum(STATUTS, { error: `Statut invalide. Valeurs acceptées : ${STATUTS.join(', ')}.` })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Au moins un champ doit être fourni pour la mise à jour.',
  });

const applicationIdParamsSchema = z.object({
  id: z.string().trim().uuid('ID de candidature invalide.'),
});

module.exports = {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdParamsSchema,
};
