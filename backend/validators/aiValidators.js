const { z } = require('zod');

const generateLetterSchema = z.object({
  description_offre: z.string().trim().min(1, 'La description de l\'offre est requise.'),
  nom_entreprise: z.string().trim().min(1, 'Le nom de l\'entreprise est requis.'),
});

const analyseATSSchema = z.object({
  application_id: z.string().trim().uuid('application_id invalide.'),
  document_id: z.string().trim().uuid('document_id invalide.'),
});

const analyseATSParamsSchema = z.object({
  applicationId: z.string().trim().uuid('applicationId invalide.'),
});

module.exports = {
  generateLetterSchema,
  analyseATSSchema,
  analyseATSParamsSchema,
};
