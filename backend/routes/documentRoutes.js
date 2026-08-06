const express = require('express');
const router = express.Router();
const {
    upload,
    uploadDocument,
    getDocumentsByApplication,
    deleteDocument,
} = require('../controllers/documentController');
const validate = require('../middlewares/validate');
const {
    uploadDocumentBodySchema,
    applicationDocumentsParamsSchema,
    documentIdParamsSchema,
} = require('../validators/documentValidators');

// Multer doit tourner avant la validation : le corps multipart n'est parsé
// qu'après le passage du middleware d'upload.
router.post('/upload', upload.single('file'), validate(uploadDocumentBodySchema), uploadDocument);

// Conservée pour compatibilité ; l'équivalent canonique est
// GET /api/applications/:applicationId/documents
router.get(
    '/application/:applicationId',
    validate(applicationDocumentsParamsSchema, 'params'),
    getDocumentsByApplication
);

router.delete('/:id', validate(documentIdParamsSchema, 'params'), deleteDocument);

module.exports = router;
