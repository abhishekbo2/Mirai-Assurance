const mongoose = require('mongoose');

const renewalApprovalRequestSchema = new mongoose.Schema({
  policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  renewal: { type: mongoose.Schema.Types.ObjectId, ref: 'Renewal', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAYMENT_WINDOW_EXPIRED'],
    default: 'PENDING'
  },
  reason: { type: String },
  supportingDocument: { type: String },
  submittedAt: { type: Date },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  paymentDeadline: { type: Date },
  paidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('RenewalApprovalRequest', renewalApprovalRequestSchema);