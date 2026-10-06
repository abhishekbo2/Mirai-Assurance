const express = require('express');
const router = express.Router();
const { getPlans, getAdminPlans, addPlan, updatePlan, setPlanActive } = require('../controllers/planController');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/', getPlans);
router.get('/admin/all', protect, requireRole('admin'), getAdminPlans);
router.post('/add', protect, requireRole('admin'), addPlan);
router.put('/:id', protect, requireRole('admin'), updatePlan);
router.patch('/:id/status', protect, requireRole('admin'), setPlanActive);
module.exports = router;
