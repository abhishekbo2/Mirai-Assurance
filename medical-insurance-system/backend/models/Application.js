const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan', required: true},
  status: { type: String, enum: ['pending', 'active', 'default', 'Pending Admin Approval', 'approved', 'rejected'], default: 'Pending Admin Approval' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  appliedDate: { type: Date, default: Date.now },
  paymentDate:{type: Date },
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  applicantType: {type: String, enum: ['individual', 'family'], default: 'individual'},
  applicantAge: { type: Number, min: 0, max: 120 },
  healthDeclaration: {
    diabetes: { type: Boolean, default: false },
    hypertension: { type: Boolean, default: false },
    cardiacIssues: { type: Boolean, default: false },
    asthma: { type: Boolean, default: false },
    cancer: { type: Boolean, default: false },
    kidneyDisease: { type: Boolean, default: false },
    other: { type: Boolean, default: false }
  },
  medicalClearanceDocument: { type: String, default: null }
});

module.exports = mongoose.model('Application', applicationSchema);
