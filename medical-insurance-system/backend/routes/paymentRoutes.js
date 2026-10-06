const express = require('express');
const router = express.Router();
const {
	createOrder,
	verifyPayment,
	createRenewalOrder,
	verifyRenewalPayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/renewal/order', protect, createRenewalOrder);
router.post('/renewal/verify', protect, verifyRenewalPayment);

module.exports = router;