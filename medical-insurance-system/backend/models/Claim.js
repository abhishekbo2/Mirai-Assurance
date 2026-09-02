const mongoose = require('mongoose');
const claimSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  type: { type: String, enum: ['Cashless', 'Reimbursement'], required: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  documents: [String], 
  bankDetails: {
    accountNumber: String,
    ifsc: String
  },
  preAuthApproved: { type: Boolean, default: false } // For Cashless flow
});
module.exports = mongoose.model('Claim', claimSchema);