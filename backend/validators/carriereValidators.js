const { z } = require('zod');
const { FORMATION_STATUTS, INTERVIEW_TYPES, INTERVIEW_MODALITES } = require('../config/constants');

const uuid = (nom) => z.string().trim().uuid(`${nom} invalide.`);
const texteOptionnel = (max = 255) => z.string().trim().max(max).optional().or(z.literal(''));
const urlOptionnelle = z.string().trim().url('URL invalide.').optional().or(z.literal(''));
const dateOptionnelle = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.')
  .optional()
  .or(z.literal(''));

const idParamsSchema = z.object({ id: uuid('ID') });

// ---------------------------------------------------------------- formations
const createFormationSchema = z.object({
  titre: z.string().trim().min(1, 'Le titre est requis.').max(255),
  organisme: texteOptionnel(),
  statut: z.enum(FORMATION_STATUTS).optional(),
  date_debut: dateOptionnelle,
  date_fin: dateOptionnelle,
  url: urlOptionnelle,
  competences: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  notes: z.string().trim().max(5000).optional(),
});

const updateFormationSchema = createFormationSchema
  .partial()
  .extend({ certificat_id: uuid('certificat_id').optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Au moins un champ doit être fourni.' });

// ------------------------------------------------------------------ contacts
const createContactSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis.').max(255),
  role: texteOptionnel(),
  email: z.string().trim().email('Email invalide.').optional().or(z.literal('')),
  telephone: texteOptionnel(64),
  linkedin_url: urlOptionnelle,
  notes: z.string().trim().max(5000).optional(),
  application_id: uuid('application_id').optional(),
  company_id: uuid('company_id').optional(),
});

const updateContactSchema = createContactSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Au moins un champ doit être fourni.' });

// ------------------------------------------------------------------ relances
const createRelanceSchema = z.object({
  application_id: uuid('application_id'),
  libelle: z.string().trim().min(1, 'Le libellé est requis.').max(255),
  echeance: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Échéance attendue au format AAAA-MM-JJ.'),
});

const toggleRelanceSchema = z.object({ fait: z.boolean() });

// ---------------------------------------------------------------- entretiens
const createInterviewSchema = z.object({
  application_id: uuid('application_id'),
  // Horodatage ISO complet : l'heure compte pour un entretien.
  date_entretien: z.string().trim().min(1, 'La date est requise.'),
  type_entretien: z.enum(INTERVIEW_TYPES).optional(),
  modalite: z.enum(INTERVIEW_MODALITES).optional(),
  lieu: texteOptionnel(512),
  contact_id: uuid('contact_id').optional(),
  notes_prepa: z.string().trim().max(10000).optional(),
});

const updateInterviewSchema = z
  .object({
    date_entretien: z.string().trim().min(1).optional(),
    type_entretien: z.enum(INTERVIEW_TYPES).optional(),
    modalite: z.enum(INTERVIEW_MODALITES).optional(),
    lieu: texteOptionnel(512),
    contact_id: uuid('contact_id').optional(),
    notes_prepa: z.string().trim().max(10000).optional(),
    reponses_star: z
      .array(
        z.object({
          question: z.string().trim().min(1),
          situation: z.string().trim().optional(),
          tache: z.string().trim().optional(),
          action: z.string().trim().optional(),
          resultat: z.string().trim().optional(),
        })
      )
      .max(30)
      .optional(),
    questions_a_poser: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
    bilan: z.string().trim().max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Au moins un champ doit être fourni.' });

const preparerInterviewSchema = z.object({
  langue: z.enum(['de', 'en', 'fr']).optional().default('de'),
});

module.exports = {
  idParamsSchema,
  createFormationSchema,
  updateFormationSchema,
  createContactSchema,
  updateContactSchema,
  createRelanceSchema,
  toggleRelanceSchema,
  createInterviewSchema,
  updateInterviewSchema,
  preparerInterviewSchema,
};
