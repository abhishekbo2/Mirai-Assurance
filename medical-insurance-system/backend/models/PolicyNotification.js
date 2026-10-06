const mongoose = require('mongoose');

const policyNotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', index: true },
  renewal: { type: mongoose.Schema.Types.ObjectId, ref: 'Renewal', index: true },
  type: {
    type: String,
    enum: ['RENEWAL_WINDOW_OPENED', 'GRACE_PERIOD_STARTED', 'APPROVAL_REQUEST_SUBMITTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'PAYMENT_DEADLINE_CREATED', 'POLICY_EXPIRING', 'POLICY_EXPIRED', 'RENEWAL_COMPLETED'],
    required: true
  },
  status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
  scheduledFor: { type: Date },
  sentAt: { type: Date },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String },
  dedupeKey: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('PolicyNotification', policyNotificationSchema);