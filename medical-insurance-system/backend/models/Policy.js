const mongoose = require('mongoose');

const purchasedTermsSchema = new mongoose.Schema({
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

const maturitySchema = new mongoose.Schema({
  maturityDate: { type: Date },
  maturedAt: { type: Date }
}, { _id: false });

const policySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'InsurancePlan', required: true },
  policyNumber: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'IN_RENEWAL_WINDOW', 'IN_GRACE_PERIOD', 'AWAITING_LATE_RENEWAL_REQUEST', 'LATE_RENEWAL_APPROVED', 'EXPIRED', 'CANCELLED', 'MATURED'],
    default: 'ACTIVE'
  },
  originalStartDate: { type: Date },
  originalEndDate: { type: Date },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date, index: true },
  nextRenewalDate: { type: Date },
  renewalSequence: { type: Number, default: 0, min: 0 },
  renewalCount: { type: Number, default: 0, min: 0 },
  initialPremium: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  purchasedTerms: { type: purchasedTermsSchema, required: true },
  historicalSnapshotSource: { type: String, enum: ['ORIGINAL', 'BACKFILLED_ESTIMATE'], default: 'ORIGINAL' },
  expiredAt: { type: Date },
  maturity: { type: maturitySchema }
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);