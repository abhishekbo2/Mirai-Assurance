require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Policy = require('../models/Policy');
const Renewal = require('../models/Renewal');

const dryRun = process.argv.includes('--dry-run');
const RENEWAL_WINDOW_MONTHS = 1;
const GRACE_PERIOD_DAYS = 15;
const LATE_REQUEST_WINDOW_MONTHS = 1;

const totals = {
  eligible: 0,
  created: 0,
  wouldCreate: 0,
  skipped: 0,
  errors: 0,
};

const log = (message) => console.log(`[createRenewals] ${message}`);

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const addUtcMonths = (date, months) => {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const addUtcDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const getRenewalDates = (periodEndDate) => {
  const periodEnd = new Date(periodEndDate);
  const renewalWindowStart = addUtcMonths(periodEnd, -RENEWAL_WINDOW_MONTHS);
  const gracePeriodStart = new Date(periodEnd);
  const gracePeriodEnd = addUtcDays(gracePeriodStart, GRACE_PERIOD_DAYS);
  const lateRequestStart = new Date(gracePeriodEnd);
  const lateRequestEnd = addUtcMonths(lateRequestStart, LATE_REQUEST_WINDOW_MONTHS);

  return {
    renewalWindowStart,
    renewalWindowEnd: new Date(periodEnd),
    gracePeriodStart,
    gracePeriodEnd,
    lateRequestStart,
    lateRequestEnd,
  };
};

const getInitialRenewalStatus = (dates, now = new Date()) => {
  if (now < dates.renewalWindowStart) return 'NOT_OPEN';
  if (now < dates.gracePeriodStart) return 'RENEWAL_WINDOW_OPEN';
  if (now < dates.lateRequestStart) return 'GRACE_PERIOD';
  if (now <= dates.lateRequestEnd) return 'LATE_APPROVAL_REQUIRED';
  return 'EXPIRED';
};

const clonePlanSnapshot = (purchasedTerms) => {
  if (!purchasedTerms) return null;
  return typeof purchasedTerms.toObject === 'function'
    ? purchasedTerms.toObject()
    : { ...purchasedTerms };
};

const isEligiblePolicy = (policy) => (
  policy.status !== 'CANCELLED'
  && policy.status !== 'MATURED'
  && isValidDate(policy.currentPeriodStart)
  && isValidDate(policy.currentPeriodEnd)
  && Boolean(policy.user)
  && Boolean(policy.purchasedTerms?.premium)
);

const buildRenewalData = (policy, now = new Date()) => {
  if (!isEligiblePolicy(policy)) {
    throw new Error('Policy is missing a valid period, user, or purchased terms.');
  }

  const sequence = (policy.renewalSequence || 0) + 1;
  const dates = getRenewalDates(policy.currentPeriodEnd);
  const planSnapshot = clonePlanSnapshot(policy.purchasedTerms);

  return {
    policy: policy._id,
    user: policy.user,
    sequence,
    status: getInitialRenewalStatus(dates, now),
    periodStartDate: new Date(policy.currentPeriodStart),
    periodEndDate: new Date(policy.currentPeriodEnd),
    ...dates,
    premiumAmount: policy.purchasedTerms.premium,
    currency: policy.currency || 'INR',
    planSnapshot,
    approvalRequest: null,
  };
};

const processPolicy = async (policy, now = new Date()) => {
  if (!isEligiblePolicy(policy)) {
    totals.errors += 1;
    log(`ERROR ${policy._id}: missing valid scheduled period, user, or purchased terms.`);
    return null;
  }

  totals.eligible += 1;
  const sequence = (policy.renewalSequence || 0) + 1;
  const existing = await Renewal.findOne({ policy: policy._id, sequence }).select('_id');
  if (existing) {
    totals.skipped += 1;
    log(`SKIP ${policy._id}: Renewal sequence ${sequence} already exists.`);
    return existing;
  }

  const renewalData = buildRenewalData(policy, now);
  if (dryRun) {
    totals.wouldCreate += 1;
    log(`WOULD CREATE ${policy._id}: sequence=${sequence}, status=${renewalData.status}, window=${renewalData.renewalWindowStart.toISOString()} -> ${renewalData.renewalWindowEnd.toISOString()}.`);
    return renewalData;
  }

  try {
    const renewal = await Renewal.create(renewalData);
    totals.created += 1;
    log(`CREATE ${policy._id}: Renewal ${renewal._id}, sequence=${sequence}, status=${renewal.status}.`);
    return renewal;
  } catch (error) {
    if (error?.code === 11000) {
      totals.skipped += 1;
      log(`SKIP ${policy._id}: Renewal sequence ${sequence} was created concurrently.`);
      return Renewal.findOne({ policy: policy._id, sequence }).select('_id');
    }
    throw error;
  }
};

const printSummary = () => {
  log(`Eligible: ${totals.eligible}`);
  log(`Renewals Created: ${dryRun ? 0 : totals.created}`);
  log(`Would Create: ${dryRun ? totals.wouldCreate : 0}`);
  log(`Already Existing / Skipped: ${totals.skipped}`);
  log(`Errors: ${totals.errors}`);
};

const main = async () => {
  if (dryRun) log('DRY RUN: no Renewal records will be created.');
  await connectDB();

  try {
    const policies = Policy.find({ status: { $nin: ['CANCELLED', 'MATURED'] } }).cursor();
    for await (const policy of policies) {
      try {
        await processPolicy(policy);
      } catch (error) {
        totals.errors += 1;
        log(`ERROR ${policy._id}: ${error.message}`);
      }
    }
    printSummary();
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`[createRenewals] Fatal error: ${error.message}`);
    mongoose.disconnect().finally(() => process.exitCode = 1);
  });
}

module.exports = {
  addUtcMonths,
  addUtcDays,
  getRenewalDates,
  getInitialRenewalStatus,
  isEligiblePolicy,
  buildRenewalData,
  processPolicy,
  totals,
};
