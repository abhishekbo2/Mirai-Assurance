const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', default: null, index: true },
  renewal: { type: mongoose.Schema.Types.ObjectId, ref: 'Renewal', default: null, index: true },
  kind: { type: String, enum: ['INITIAL_APPLICATION', 'RENEWAL'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['CREATED', 'ORDER_CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'],
    default: 'CREATED'
  },
  provider: { type: String },
  providerOrderId: { type: String },
  providerPaymentId: { type: String },
  idempotencyKey: { type: String, required: true, unique: true },
  receipt: { type: String },
  failureCode: { type: String },
  failureMessage: { type: String },
  initiatedAt: { type: Date },
  paidAt: { type: Date },
  failedAt: { type: Date }
}, { timestamps: true });

paymentSchema.index({ providerOrderId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);