const express = require('express');
const router = express.Router();

const { 
  getAllCustomers, 
  getUnpaidApplications, 
  notifyDefault, 
  updateClaimStatus 
} = require('../controllers/adminController');

const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/customers', protect, requireRole('admin'), getAllCustomers);
router.get('/unpaid', protect, requireRole('admin'), getUnpaidApplications);
router.post('/notify', protect, requireRole('admin'), notifyDefault);
router.put('/claim-status', protect, requireRole('admin'), updateClaimStatus);

module.exports = router;
