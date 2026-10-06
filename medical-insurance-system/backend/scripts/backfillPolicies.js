require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Application = require('../models/Application');
const InsurancePlan = require('../models/InsurancePlan');
require('../models/User');
const Policy = require('../models/Policy');

const dryRun = process.argv.includes('--dry-run');

const totals = {
  eligible: 0,
  created: 0,
  linked: 0,
  skipped: 0,
  needsManualReview: 0,
  errors: 0,
  validPaymentDate: 0,
  missingPaymentDate: 0,
  reliableHistoricalPremium: 0,
  estimatedPremium: 0,
  missingUser: 0,
  missingPlan: 0,
};

const log = (message) => console.log(`[backfillPolicies] ${message}`);

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const getHistoricalPremium = (application, plan) => {
  const candidates = [
    application.amountPaid,
    application.paidAmount,
    application.paymentAmount,
    application.premiumPaid,
    application.amount,
  ];
  const storedAmount = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);

  if (storedAmount !== undefined) {
    return { amount: Number(storedAmount), estimated: false, source: 'application payment amount' };
  }

  return { amount: Number(plan.premium), estimated: true, source: 'current InsurancePlan.premium' };
};

const getOneYearLater = (date) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + 1);
  return result;
};

const getPolicyStatus = (periodEnd) => (periodEnd >= new Date() ? 'ACTIVE' : 'EXPIRED');

const buildPolicyData = (application, plan, premium) => {
  const originalStartDate = new Date(application.paymentDate);
  const originalEndDate = getOneYearLater(originalStartDate);
  const historicalSnapshotSource = premium.estimated ? 'BACKFILLED_ESTIMATE' : 'ORIGINAL';

  return {
    user: application.user,
    application: application._id,
    plan: application.plan,
    policyNumber: `MIGRATED-${application._id.toString().toUpperCase()}`,
    status: getPolicyStatus(originalEndDate),
    originalStartDate,
    originalEndDate,
    currentPeriodStart: originalStartDate,
    currentPeriodEnd: originalEndDate,
    nextRenewalDate: originalEndDate,
    renewalSequence: 0,
    renewalCount: 0,
    initialPremium: premium.amount,
    currency: 'INR',
    purchasedTerms: {
      title: plan.title,
      category: plan.category,
      premium: premium.amount,
      coverage: plan.coverage,
      coveredConditions: plan.coveredConditions || [],
      terms: plan.terms || '',
      exclusions: plan.exclusions || '',
      networkBenefits: plan.networkBenefits || '',
      durationValue: plan.durationValue || 1,
      durationUnit: plan.durationUnit || 'year',
    },
    historicalSnapshotSource,
  };
};

const linkExistingPolicy = async (application, policy) => {
  if (application.policy) {
    totals.skipped += 1;
    log(`SKIP ${application._id}: Application.policy is already set to ${application.policy}.`);
    return;
  }

  if (dryRun) {
    totals.skipped += 1;
    log(`SKIP ${application._id}: Policy ${policy._id} already exists for this application.`);
    return;
  }

  await Application.updateOne(
    { _id: application._id, policy: null },
    { $set: { policy: policy._id } },
  );
  totals.linked += 1;
  log(`LINK ${application._id}: linked existing Policy ${policy._id} without modifying it.`);
};

const processApplication = async (application) => {
  totals.eligible += 1;

  if (application.policy) {
    totals.skipped += 1;
    log(`SKIP ${application._id}: already linked to Policy ${application.policy}.`);
    return;
  }

  const existingPolicy = await Policy.findOne({ application: application._id }).select('_id policyNumber').lean();
  if (existingPolicy) {
    await linkExistingPolicy(application, existingPolicy);
    return;
  }

  if (!isValidDate(application.paymentDate)) {
    totals.needsManualReview += 1;
    totals.missingPaymentDate += 1;
    log(`REVIEW ${application._id}: paymentDate is missing or invalid; no Policy will be created.`);
    return;
  }
  totals.validPaymentDate += 1;

  const [user, plan] = await Promise.all([
    mongoose.model('User').findById(application.user).select('_id').lean(),
    InsurancePlan.findById(application.plan).lean(),
  ]);

  if (!user) {
    totals.errors += 1;
    totals.missingUser += 1;
    log(`ERROR ${application._id}: referenced User ${application.user} does not exist.`);
    return;
  }
  if (!plan) {
    totals.errors += 1;
    totals.missingPlan += 1;
    log(`ERROR ${application._id}: referenced InsurancePlan ${application.plan} does not exist.`);
    return;
  }

  const premium = getHistoricalPremium(application, plan);
  if (premium.estimated) {
    totals.estimatedPremium += 1;
    log(`ESTIMATE ${application._id}: no stored paid amount; using current plan premium ${premium.amount}.`);
  } else {
    totals.reliableHistoricalPremium += 1;
  }

  const policyData = buildPolicyData(application, plan, premium);
  if (dryRun) {
    log(`WOULD CREATE ${application._id}: ${policyData.policyNumber}, start=${policyData.originalStartDate.toISOString()}, end=${policyData.originalEndDate.toISOString()}, premium=${policyData.initialPremium}, source=${policyData.historicalSnapshotSource}.`);
    totals.created += 1;
    return;
  }

  let policy;
  try {
    policy = await Policy.create(policyData);
  } catch (error) {
    if (error?.code === 11000) {
      const concurrentPolicy = await Policy.findOne({ application: application._id }).select('_id policyNumber').lean();
      if (concurrentPolicy) {
        await linkExistingPolicy(application, concurrentPolicy);
        return;
      }
    }
    throw error;
  }

  await Application.updateOne(
    { _id: application._id, policy: null },
    { $set: { policy: policy._id } },
  );
  totals.created += 1;
  totals.linked += 1;
  log(`CREATE ${application._id}: Policy ${policy._id} (${policy.policyNumber}); Application linked.`);
};

const printSummary = () => {
  log(`Eligible: ${totals.eligible}`);
  log(`Policies Created: ${dryRun ? 0 : totals.created}`);
  log(`Applications Linked: ${dryRun ? 0 : totals.linked}`);
  log(`Would Create: ${dryRun ? totals.created : 0}`);
  log(`Already Linked / Skipped: ${totals.skipped}`);
  log(`Needs Manual Review: ${totals.needsManualReview}`);
  log(`Errors: ${totals.errors}`);
  log(`Valid paymentDate: ${totals.validPaymentDate}`);
  log(`Missing or invalid paymentDate: ${totals.missingPaymentDate}`);
  log(`Reliable historical premium: ${totals.reliableHistoricalPremium}`);
  log(`Estimated premium: ${totals.estimatedPremium}`);
  log(`Missing User: ${totals.missingUser}`);
  log(`Missing InsurancePlan: ${totals.missingPlan}`);
};

const main = async () => {
  if (dryRun) log('DRY RUN: no inserts or updates will be performed.');
  await connectDB();

  try {
    const applications = Application.find({ status: 'approved', paymentStatus: 'paid' }).cursor();
    for await (const application of applications) {
      try {
        await processApplication(application);
      } catch (error) {
        totals.errors += 1;
        log(`ERROR ${application._id}: ${error.message}`);
      }
    }
    printSummary();
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(`[backfillPolicies] Fatal error: ${error.message}`);
  mongoose.disconnect().finally(() => process.exitCode = 1);
});
