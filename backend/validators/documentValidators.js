const { z } = require('zod');
const { DOCUMENT_TYPES } = require('../config/constants');

const uploadDocumentBodySchema = z.object({
  application_id: z.string().trim().uuid('application_id invalide.'),
  // L'ENUM document_type en base ne connaît que cv | lettre_motivation | autre.
  type_document: z.enum(DOCUMENT_TYPES).optional().default('autre'),
  libelle: z.string().trim().max(255).optional(),
});

const applicationDocumentsParamsSchema = z.object({
  applicationId: z.string().trim().uuid('applicationId invalide.'),
});

const documentIdParamsSchema = z.object({
  id: z.string().trim().uuid('ID de document invalide.'),
});

const uploadCvBodySchema = z.object({
  libelle: z.string().trim().max(255).optional(),
});

const renameCvBodySchema = z.object({
  libelle: z.string().trim().min(1, 'Le libellé est requis.').max(255),
});

module.exports = {
  uploadDocumentBodySchema,
  applicationDocumentsParamsSchema,
  documentIdParamsSchema,
  uploadCvBodySchema,
  renameCvBodySchema,
};
