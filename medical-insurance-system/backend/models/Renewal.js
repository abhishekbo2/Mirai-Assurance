const mongoose = require('mongoose');

const planSnapshotSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  premium: { type: Number, required: true },
  coverage: { type: Number, required: true },
  coveredConditions: { type: [String], default: [] },
  terms: { type: String, default: '' },
  exclusions: { type: String, default: '' },
  networkBenefits: { type: String, default: '' },
  durationValue: { type: Number, required: true, min: 1 },
  durationUnit: { type: String, enum: ['month', 'year'], required: true }
}, { _id: false });

const renewalSchema = new mongoose.Schema({
  policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['NOT_OPEN', 'RENEWAL_WINDOW_OPEN', 'GRACE_PERIOD', 'LATE_APPROVAL_REQUIRED', 'LATE_APPROVAL_PENDING', 'LATE_APPROVAL_APPROVED', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'COMPLETED', 'EXPIRED'],
    default: 'NOT_OPEN'
  },
  periodStartDate: { type: Date },
  periodEndDate: { type: Date },
  renewalWindowStart: { type: Date },
  renewalWindowEnd: { type: Date },
  gracePeriodStart: { type: Date },
  gracePeriodEnd: { type: Date },
  lateRequestStart: { type: Date },
  lateRequestEnd: { type: Date },
  premiumAmount: { type: Number },
  currency: { type: String, default: 'INR' },
  planSnapshot: { type: planSnapshotSchema },
  approvalRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RenewalApprovalRequest', default: null },
  requestedAt: { type: Date },
  paidAt: { type: Date },
  completedAt: { type: Date },
  expiredAt: { type: Date }
}, { timestamps: true });

renewalSchema.index({ policy: 1, sequence: 1 }, { unique: true });

module.exports = mongoose.model('Renewal', renewalSchema);