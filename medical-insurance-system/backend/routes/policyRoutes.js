const express = require('express');
const { getPolicies, getPolicy, getRenewalState } = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/', getPolicies);
router.get('/:id/renewal-state', getRenewalState);
router.get('/:id', getPolicy);

module.exports = router;