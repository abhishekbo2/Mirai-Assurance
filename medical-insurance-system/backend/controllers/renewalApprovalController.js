const mongoose = require('mongoose');
const Renewal = require('../models/Renewal');
const RenewalApprovalRequest = require('../models/RenewalApprovalRequest');
const Payment = require('../models/Payment');
const Policy = require('../models/Policy');
const notificationService = require('../services/policyNotificationService');

const LATE_APPROVAL_STATUSES = ['LATE_APPROVAL_REQUIRED', 'LATE_APPROVAL_PENDING'];

const isWithinLateRequestWindow = (renewal, now = new Date()) => (
  renewal.status === 'LATE_APPROVAL_REQUIRED'
  && renewal.lateRequestStart instanceof Date
  && renewal.lateRequestEnd instanceof Date
  && now >= renewal.lateRequestStart
  && now <= renewal.lateRequestEnd
);

const getRenewalForUser = async (renewalId, userId) => {
  if (!mongoose.isValidObjectId(renewalId)) return null;
  return Renewal.findOne({ _id: renewalId, user: userId });
};

const expireOverdueApproval = async (request, now = new Date()) => {
  if (!request || request.status !== 'APPROVED' || !request.paymentDeadline
    || now <= request.paymentDeadline) return request;

  const paidPayment = await Payment.findOne({
    renewal: request.renewal,
    kind: 'RENEWAL',
    status: 'PAID',
  });
  if (paidPayment) return request;

  const expiredAt = new Date(now);
  await RenewalApprovalRequest.updateOne(
    { _id: request._id, status: 'APPROVED' },
    { $set: { status: 'PAYMENT_WINDOW_EXPIRED' } },
  );
  await Renewal.updateOne(
    { _id: request.renewal, status: 'LATE_RENEWAL_APPROVED' },
    { $set: { status: 'EXPIRED', expiredAt } },
  );
  await Policy.updateOne(
    { _id: request.policy },
    { $set: { status: 'EXPIRED', expiredAt } },
  );
  await notificationService.safelyRecordNotification({
    type: 'POLICY_EXPIRED',
    renewal: { _id: request.renewal, sequence: request.sequence, user: request.user, policy: request.policy },
    policy: request.policy,
    user: request.user,
    scheduledFor: expiredAt,
  });
  request.status = 'PAYMENT_WINDOW_EXPIRED';
  return request;
};

exports.submitRequest = async (req, res) => {
  try {
    const { renewalId, reason, supportingDocument } = req.body || {};
    if (!reason?.trim() || !supportingDocument?.trim()) {
      return res.status(400).json({ msg: 'Reason and supporting-document reference are required.' });
    }

    const renewal = await getRenewalForUser(renewalId, req.user.id);
    if (!renewal) return res.status(404).json({ msg: 'Renewal not found.' });
    if (!isWithinLateRequestWindow(renewal)) {
      return res.status(400).json({ msg: 'Late-renewal requests are not currently allowed.' });
    }

    const policyId = renewal.policy?._id || renewal.policy;
    const policy = await Policy.findOne({ _id: policyId, user: req.user.id });
    if (!policy) return res.status(404).json({ msg: 'Policy not found.' });
    if (['EXPIRED', 'CANCELLED', 'MATURED'].includes(policy.status)) {
      return res.status(409).json({ msg: 'This Policy cannot accept a late-renewal request.' });
    }

    const existing = await RenewalApprovalRequest.findOne({ renewal: renewal._id });
    if (existing) return res.status(409).json({ msg: 'A request already exists for this renewal.' });

    let approvalRequest;
    try {
      approvalRequest = await RenewalApprovalRequest.create({
        policy: renewal.policy,
        renewal: renewal._id,
        user: req.user.id,
        sequence: renewal.sequence,
        status: 'PENDING',
        reason: reason.trim(),
        supportingDocument: supportingDocument.trim(),
        submittedAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      return res.status(409).json({ msg: 'A request already exists for this renewal.' });
    }

    await Policy.updateOne(
      { _id: policyId, user: req.user.id, status: { $nin: ['EXPIRED', 'CANCELLED', 'MATURED'] } },
      { $set: { status: 'AWAITING_LATE_RENEWAL_REQUEST' } },
    );

    await Renewal.updateOne(
      { _id: renewal._id, status: 'LATE_APPROVAL_REQUIRED' },
      { $set: { status: 'LATE_APPROVAL_PENDING', approvalRequest: approvalRequest._id } },
    );
    await notificationService.safelyRecordNotification({
      type: 'APPROVAL_REQUEST_SUBMITTED',
      renewal,
      policy: policyId,
      user: req.user.id,
    });
    res.status(201).json(approvalRequest);
  } catch (error) {
    console.error('Late-renewal submission error:', error);
    res.status(500).json({ msg: 'Unable to submit late-renewal request.' });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const requests = await RenewalApprovalRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    for (const request of requests) await expireOverdueApproval(request);
    res.json(requests);
  } catch (error) {
    console.error('Customer approval-request lookup error:', error);
    res.status(500).json({ msg: 'Unable to fetch late-renewal requests.' });
  }
};

exports.getMyRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'Request not found.' });
    const request = await RenewalApprovalRequest.findOne({ _id: req.params.id, user: req.user.id });
    if (!request) return res.status(404).json({ msg: 'Request not found.' });
    await expireOverdueApproval(request);
    res.json(request);
  } catch (error) {
    console.error('Customer approval-request detail error:', error);
    res.status(500).json({ msg: 'Unable to fetch late-renewal request.' });
  }
};

exports.getAdminRequests = async (req, res) => {
  try {
    const requests = await RenewalApprovalRequest.find().sort({ createdAt: -1 });
    for (const request of requests) await expireOverdueApproval(request);
    res.json(requests);
  } catch (error) {
    console.error('Admin approval-request lookup error:', error);
    res.status(500).json({ msg: 'Unable to fetch late-renewal requests.' });
  }
};

exports.getAdminRequest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'Request not found.' });
    const request = await RenewalApprovalRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found.' });
    await expireOverdueApproval(request);
    res.json(request);
  } catch (error) {
    console.error('Admin approval-request detail error:', error);
    res.status(500).json({ msg: 'Unable to fetch late-renewal request.' });
  }
};

const decideRequest = async (req, res, decision) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: 'Request not found.' });
    const request = await RenewalApprovalRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found.' });
    await expireOverdueApproval(request);
    if (request.status !== 'PENDING') {
      return res.status(409).json({ msg: 'This request has already been decided.' });
    }

    const now = new Date();
    const renewal = await Renewal.findOne({ _id: request.renewal, status: 'LATE_APPROVAL_PENDING' });
    if (!renewal) return res.status(409).json({ msg: 'This renewal is no longer awaiting approval.' });

    const requestUpdate = decision === 'approve'
      ? { status: 'APPROVED', reviewedAt: now, reviewedBy: req.user.id, paymentDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
      : { status: 'REJECTED', reviewedAt: now, reviewedBy: req.user.id, rejectionReason: req.body?.rejectionReason?.trim() || 'Late-renewal request rejected.' };
    const updatedRequest = await RenewalApprovalRequest.findOneAndUpdate(
      { _id: request._id, status: 'PENDING' },
      { $set: requestUpdate },
      { new: true },
    );
    if (!updatedRequest) return res.status(409).json({ msg: 'This request has already been decided.' });

    const renewalUpdate = decision === 'approve'
      ? { $set: { status: 'LATE_RENEWAL_APPROVED', approvalRequest: request._id } }
      : { $set: { status: 'EXPIRED', expiredAt: now, approvalRequest: request._id } };
    await Renewal.updateOne({ _id: renewal._id, status: 'LATE_APPROVAL_PENDING' }, renewalUpdate);
    if (decision === 'reject') {
      await Policy.updateOne({ _id: request.policy }, { $set: { status: 'EXPIRED', expiredAt: now } });
    }
    await notificationService.safelyRecordNotification({
      type: decision === 'approve' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      renewal,
      policy: request.policy,
      user: request.user,
    });
    if (decision === 'approve') {
      await notificationService.safelyRecordNotification({
        type: 'PAYMENT_DEADLINE_CREATED',
        renewal,
        policy: request.policy,
        user: request.user,
        scheduledFor: requestUpdate.paymentDeadline,
      });
    } else {
      await notificationService.safelyRecordNotification({
        type: 'POLICY_EXPIRED',
        renewal,
        policy: request.policy,
        user: request.user,
        scheduledFor: now,
      });
    }
    res.json(updatedRequest);
  } catch (error) {
    console.error(`Late-renewal ${decision} error:`, error);
    res.status(500).json({ msg: `Unable to ${decision} late-renewal request.` });
  }
};

exports.approveRequest = (req, res) => decideRequest(req, res, 'approve');
exports.rejectRequest = (req, res) => decideRequest(req, res, 'reject');
exports.isWithinLateRequestWindow = isWithinLateRequestWindow;
exports.expireOverdueApproval = expireOverdueApproval;