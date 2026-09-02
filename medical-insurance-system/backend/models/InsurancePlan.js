const mongoose = require('mongoose');
const planSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  premium: { type: Number, required: true },
  coverage: { type: Number, required: true },
  minEligibleAge: { type: Number, default: 18, min: 0 },
  maxEligibleAge: { type: Number, default: 65, min: 0 },
  coveredConditions: { type: [String], default: [] },
  terms: { type: String, default: '' },
  exclusions: { type: String, default: '' },
  networkBenefits: { type: String, default: '' }
});
module.exports = mongoose.model('InsurancePlan', planSchema);
