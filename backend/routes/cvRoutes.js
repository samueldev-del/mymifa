const express = require('express');
const router = express.Router();
const { upload, listCvs, uploadCv, renameCv, deleteCv } = require('../controllers/cvController');
const validate = require('../middlewares/validate');
const {
    uploadCvBodySchema,
    renameCvBodySchema,
    documentIdParamsSchema,
} = require('../validators/documentValidators');

// Bibliothèque de CV de base (CV français, CV anglais...), indépendante des
// candidatures.
router.get('/', listCvs);
router.post('/', upload.single('file'), validate(uploadCvBodySchema), uploadCv);
router.put(
    '/:id',
    validate(documentIdParamsSchema, 'params'),
    validate(renameCvBodySchema),
    renameCv
);
router.delete('/:id', validate(documentIdParamsSchema, 'params'), deleteCv);

module.exports = router;
