const express = require('express');
const router = express.Router();
const { getProfil, updateProfil } = require('../controllers/profilController');
const validate = require('../middlewares/validate');
const { updateProfilSchema } = require('../validators/profilValidators');

router.get('/', getProfil);
router.put('/', validate(updateProfilSchema), updateProfil);

module.exports = router;
