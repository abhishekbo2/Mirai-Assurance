const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const Renewal = require('../models/Renewal');

const RENEWAL_WINDOW_DAYS = 30;
const GRACE_PERIOD_DAYS = 30;
const LATE_REQUEST_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const calculateRenewalState = (policy, now = new Date()) => {
  const currentPeriodStart = policy.currentPeriodStart;
  const currentPeriodEnd = policy.currentPeriodEnd;

  if (!(currentPeriodStart instanceof Date) || !(currentPeriodEnd instanceof Date)
    || Number.isNaN(currentPeriodStart.getTime()) || Number.isNaN(currentPeriodEnd.getTime())) {
    return {
      currentPeriodStart: currentPeriodStart || null,
      currentPeriodEnd: currentPeriodEnd || null,
      renewalWindowStart: null,
      renewalWindowEnd: null,
      gracePeriodStart: null,
      gracePeriodEnd: null,
      lateRequestStart: null,
      lateRequestEnd: null,
      renewalState: 'UNAVAILABLE',
      normalRenewalPaymentAllowed: false,
      lateRenewalRequestAllowed: false,
      finallyExpired: policy.status === 'EXPIRED',
    };
  }

  const renewalWindowStart = addDays(currentPeriodEnd, -RENEWAL_WINDOW_DAYS);
  const renewalWindowEnd = currentPeriodEnd;
  const gracePeriodStart = currentPeriodEnd;
  const gracePeriodEnd = addDays(currentPeriodEnd, GRACE_PERIOD_DAYS);
  const lateRequestStart = gracePeriodEnd;
  const lateRequestEnd = addDays(gracePeriodEnd, LATE_REQUEST_WINDOW_DAYS);
  const finallyExpired = policy.status === 'EXPIRED' || now > lateRequestEnd;
  let renewalState = 'NOT_OPEN';

  if (finallyExpired) renewalState = 'EXPIRED';
  else if (now >= lateRequestStart) renewalState = 'LATE_RENEWAL_REQUEST_WINDOW';
  else if (now >= gracePeriodStart) renewalState = 'GRACE_PERIOD';
  else if (now >= renewalWindowStart) renewalState = 'RENEWAL_WINDOW_OPEN';

  return {
    currentPeriodStart,
    currentPeriodEnd,
    renewalWindowStart,
    renewalWindowEnd,
    gracePeriodStart,
    gracePeriodEnd,
    lateRequestStart,
    lateRequestEnd,
    renewalState,
    normalRenewalPaymentAllowed: !finallyExpired && now >= renewalWindowStart && now <= gracePeriodEnd,
    lateRenewalRequestAllowed: !finallyExpired && now >= lateRequestStart && now <= lateRequestEnd,
    finallyExpired,
  };
};

const getOwnedPolicy = (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ msg: 'Policy not found.' });
    return null;
  }

  const policyQuery = Policy.findOne({ _id: req.params.id, user: req.user.id });
  return typeof policyQuery.populate === 'function'
    ? policyQuery.populate('plan')
    : policyQuery;
};

exports.getPolicies = async (req, res) => {
  try {
    const policies = await Policy.find({ user: req.user.id })
      .populate('plan')
      .sort({ currentPeriodEnd: -1 });
    res.json(policies);
  } catch (error) {
    console.error('Policy list error:', error);
    res.status(500).json({ msg: 'Server Error fetching policies' });
  }
};

exports.getPolicy = async (req, res) => {
  try {
    const policyQuery = getOwnedPolicy(req, res);
    if (!policyQuery) return;

    const policy = await policyQuery;
    if (!policy) return res.status(404).json({ msg: 'Policy not found.' });
    res.json(policy);
  } catch (error) {
    console.error('Policy detail error:', error);
    res.status(500).json({ msg: 'Server Error fetching policy' });
  }
};

exports.getRenewalState = async (req, res) => {
  try {
    const policyQuery = getOwnedPolicy(req, res);
    if (!policyQuery) return;

    const policy = await policyQuery;
    if (!policy) return res.status(404).json({ msg: 'Policy not found.' });

    const renewal = await Renewal.findOne({
      policy: policy._id,
      sequence: (policy.renewalSequence || 0) + 1,
    }).select('_id status sequence paymentDeadline');

    res.json({
      policyId: policy._id,
      policyNumber: policy.policyNumber,
      renewalId: renewal?._id || null,
      renewalStatus: renewal?.status || null,
      approvalPaymentDeadline: renewal?.paymentDeadline || null,
      status: policy.status,
      renewalSequence: policy.renewalSequence,
      renewalCount: policy.renewalCount,
      ...calculateRenewalState(policy),
    });
  } catch (error) {
    console.error('Renewal state error:', error);
    res.status(500).json({ msg: 'Server Error fetching renewal state' });
  }
};

exports.calculateRenewalState = calculateRenewalState;