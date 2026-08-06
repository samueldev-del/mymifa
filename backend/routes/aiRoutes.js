const express = require('express');
const router = express.Router();
const { generateLetter, analyseATS } = require('../controllers/aiController');
const validate = require('../middlewares/validate');
const { generateLetterSchema, analyseATSSchema } = require('../validators/aiValidators');

router.post('/generate-letter', validate(generateLetterSchema), generateLetter);
router.post('/analyse-ats', validate(analyseATSSchema), analyseATS);

module.exports = router;
