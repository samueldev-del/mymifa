const express = require('express');
const router = express.Router();
const {
    getApplications,
    getApplication,
    createApplication,
    updateApplication,
    deleteApplication,
} = require('../controllers/applicationController');
const { getDocumentsByApplication } = require('../controllers/documentController');
const { getAnalyseATS } = require('../controllers/aiController');
const validate = require('../middlewares/validate');
const {
    createApplicationSchema,
    updateApplicationSchema,
    applicationIdParamsSchema,
} = require('../validators/applicationValidators');
const { applicationDocumentsParamsSchema } = require('../validators/documentValidators');
const { analyseATSParamsSchema } = require('../validators/aiValidators');

router.get('/', getApplications);
router.post('/', validate(createApplicationSchema), createApplication);

router.get('/:id', validate(applicationIdParamsSchema, 'params'), getApplication);
router.put(
    '/:id',
    validate(applicationIdParamsSchema, 'params'),
    validate(updateApplicationSchema),
    updateApplication
);
router.delete('/:id', validate(applicationIdParamsSchema, 'params'), deleteApplication);

// Ressources rattachées à une candidature : imbriquées sous /applications/:id
// plutôt que dispersées sous /documents et /ai.
router.get(
    '/:applicationId/documents',
    validate(applicationDocumentsParamsSchema, 'params'),
    getDocumentsByApplication
);
router.get(
    '/:applicationId/ats',
    validate(analyseATSParamsSchema, 'params'),
    getAnalyseATS
);

module.exports = router;
