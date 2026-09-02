const express = require('express');
const router = express.Router();
const { getPlans, addPlan, updatePlan } = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/', getPlans);
router.post('/add', protect, requireRole('admin'), addPlan);
router.put('/:id', protect, requireRole('admin'), updatePlan);
module.exports = router;
