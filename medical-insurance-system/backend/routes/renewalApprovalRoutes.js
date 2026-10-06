const express = require('express');
const {
  submitRequest,
  getMyRequests,
  getMyRequest,
  getAdminRequests,
  getAdminRequest,
  approveRequest,
  rejectRequest,
} = require('../controllers/renewalApprovalController');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

const router = express.Router();
router.use(protect);

router.post('/', requireRole('customer'), submitRequest);
router.get('/my', requireRole('customer'), getMyRequests);
router.get('/admin', requireRole('admin'), getAdminRequests);
router.get('/admin/:id', requireRole('admin'), getAdminRequest);
router.put('/:id/approve', requireRole('admin'), approveRequest);
router.put('/:id/reject', requireRole('admin'), rejectRequest);
router.get('/:id', requireRole('customer'), getMyRequest);

module.exports = router;