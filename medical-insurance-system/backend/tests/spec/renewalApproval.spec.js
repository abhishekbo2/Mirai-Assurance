const Renewal = require('../../models/Renewal');
const RenewalApprovalRequest = require('../../models/RenewalApprovalRequest');
const Payment = require('../../models/Payment');
const Policy = require('../../models/Policy');
const approvalController = require('../../controllers/renewalApprovalController');
const paymentController = require('../../controllers/paymentController');
const notificationService = require('../../services/policyNotificationService');
const requireRole = require('../../middleware/roleMiddleware');

const createResponse = () => ({
  status: jasmine.createSpy('status').and.callFake(function returnResponse() {
    return this;
  }),
  json: jasmine.createSpy('json'),
});

const renewalId = '507f1f77bcf86cd799439011';
const requestId = '507f1f77bcf86cd799439012';

const makeRenewal = (status = 'LATE_APPROVAL_REQUIRED') => ({
  _id: renewalId,
  policy: '507f1f77bcf86cd799439013',
  user: '507f1f77bcf86cd799439014',
  sequence: 1,
  status,
  lateRequestStart: new Date('2026-09-01T00:00:00.000Z'),
  lateRequestEnd: new Date('2026-09-30T23:59:59.999Z'),
});

describe('Late-renewal approval workflow', () => {
  beforeEach(() => {
    spyOn(notificationService, 'safelyRecordNotification').and.resolveTo(null);
  });

  it('allows a customer to submit one valid late-renewal request', async () => {
    const response = createResponse();
    const renewal = makeRenewal();
    const request = {
      body: { renewalId, reason: 'Unexpected hospitalization', supportingDocument: '/uploads/medical-note.pdf' },
      user: { id: renewal.user },
    };
    const approval = { _id: requestId, status: 'PENDING' };
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(Policy, 'findOne').and.resolveTo({ _id: renewal.policy, status: 'ACTIVE' });
    spyOn(RenewalApprovalRequest, 'findOne').and.resolveTo(null);
    spyOn(RenewalApprovalRequest, 'create').and.resolveTo(approval);
    spyOn(Policy, 'updateOne').and.resolveTo({ matchedCount: 1 });
    spyOn(Renewal, 'updateOne').and.resolveTo({ matchedCount: 1 });

    await approvalController.submitRequest(request, response);

    expect(RenewalApprovalRequest.create).toHaveBeenCalledWith(jasmine.objectContaining({
      policy: renewal.policy,
      renewal: renewal._id,
      user: renewal.user,
      sequence: renewal.sequence,
      status: 'PENDING',
      reason: 'Unexpected hospitalization',
      supportingDocument: '/uploads/medical-note.pdf',
    }));
    expect(Policy.updateOne).toHaveBeenCalledWith(
      { _id: renewal.policy, user: renewal.user, status: { $nin: ['EXPIRED', 'CANCELLED', 'MATURED'] } },
      { $set: { status: 'AWAITING_LATE_RENEWAL_REQUEST' } },
    );
    expect(Renewal.updateOne).toHaveBeenCalled();
    expect(renewal.status).toBe('LATE_APPROVAL_REQUIRED');
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('rejects submission outside the late-request window', async () => {
    const response = createResponse();
    spyOn(Renewal, 'findOne').and.resolveTo(makeRenewal('GRACE_PERIOD'));
    spyOn(RenewalApprovalRequest, 'create');

    await approvalController.submitRequest({
      body: { renewalId, reason: 'Reason', supportingDocument: 'document-ref' },
      user: { id: '507f1f77bcf86cd799439014' },
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(RenewalApprovalRequest.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests for one Renewal', async () => {
    const response = createResponse();
    spyOn(Renewal, 'findOne').and.resolveTo(makeRenewal());
    spyOn(Policy, 'findOne').and.resolveTo({ _id: 'policy_1', status: 'AWAITING_LATE_RENEWAL_REQUEST' });
    spyOn(RenewalApprovalRequest, 'findOne').and.resolveTo({ _id: requestId, status: 'PENDING' });
    spyOn(RenewalApprovalRequest, 'create');

    await approvalController.submitRequest({
      body: { renewalId, reason: 'Reason', supportingDocument: 'document-ref' },
      user: { id: '507f1f77bcf86cd799439014' },
    }, response);

    expect(RenewalApprovalRequest.create).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(409);
  });

  it('rejects a late request when the Policy is already expired', async () => {
    const response = createResponse();
    spyOn(Renewal, 'findOne').and.resolveTo(makeRenewal());
    spyOn(Policy, 'findOne').and.resolveTo({ _id: 'policy_1', status: 'EXPIRED' });
    spyOn(RenewalApprovalRequest, 'findOne');
    spyOn(RenewalApprovalRequest, 'create');

    await approvalController.submitRequest({
      body: { renewalId, reason: 'Reason', supportingDocument: 'document-ref' },
      user: { id: '507f1f77bcf86cd799439014' },
    }, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(RenewalApprovalRequest.create).not.toHaveBeenCalled();
  });

  it('approves a pending request and sets a seven-day payment deadline', async () => {
    const response = createResponse();
    const pending = { _id: requestId, renewal: renewalId, policy: 'policy_1', status: 'PENDING' };
    const renewal = makeRenewal('LATE_APPROVAL_PENDING');
    const updated = { ...pending, status: 'APPROVED' };
    spyOn(RenewalApprovalRequest, 'findById').and.resolveTo(pending);
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(RenewalApprovalRequest, 'findOneAndUpdate').and.resolveTo(updated);
    spyOn(Renewal, 'updateOne').and.resolveTo({ matchedCount: 1 });

    await approvalController.approveRequest({
      params: { id: requestId },
      user: { id: 'admin_1' },
    }, response);

    const update = RenewalApprovalRequest.findOneAndUpdate.calls.mostRecent().args[1].$set;
    expect(update.status).toBe('APPROVED');
    expect(update.paymentDeadline.getTime() - update.reviewedAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(Renewal.updateOne).toHaveBeenCalledWith(
      { _id: renewal._id, status: 'LATE_APPROVAL_PENDING' },
      { $set: { status: 'LATE_RENEWAL_APPROVED', approvalRequest: pending._id } },
    );
    expect(response.json).toHaveBeenCalledWith(updated);
  });

  it('rejects a pending request and expires the Renewal and Policy', async () => {
    const response = createResponse();
    const pending = { _id: requestId, renewal: renewalId, policy: 'policy_1', status: 'PENDING' };
    const renewal = makeRenewal('LATE_APPROVAL_PENDING');
    spyOn(RenewalApprovalRequest, 'findById').and.resolveTo(pending);
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(RenewalApprovalRequest, 'findOneAndUpdate').and.resolveTo({ ...pending, status: 'REJECTED' });
    spyOn(Renewal, 'updateOne').and.resolveTo({ matchedCount: 1 });
    spyOn(Policy, 'updateOne').and.resolveTo({ matchedCount: 1 });

    await approvalController.rejectRequest({
      params: { id: requestId },
      body: { rejectionReason: 'Insufficient evidence' },
      user: { id: 'admin_1' },
    }, response);

    expect(Renewal.updateOne).toHaveBeenCalledWith(
      { _id: renewal._id, status: 'LATE_APPROVAL_PENDING' },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'EXPIRED' }) }),
    );
    expect(Policy.updateOne).toHaveBeenCalledWith(
      { _id: pending.policy },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'EXPIRED' }) }),
    );
    expect(response.status).not.toHaveBeenCalledWith(500);
  });

  it('blocks customer users from admin approval actions', () => {
    const response = createResponse();
    const next = jasmine.createSpy('next');

    requireRole('admin')({ user: { role: 'customer' } }, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('prevents decisions on already-decided requests', async () => {
    const response = createResponse();
    spyOn(RenewalApprovalRequest, 'findById').and.resolveTo({ _id: requestId, status: 'REJECTED' });

    await approvalController.approveRequest({
      params: { id: requestId },
      user: { id: 'admin_1' },
    }, response);

    expect(response.status).toHaveBeenCalledWith(409);
  });

  it('expires an unpaid approved request after its seven-day deadline', async () => {
    const response = createResponse();
    const request = {
      _id: requestId,
      renewal: renewalId,
      policy: 'policy_1',
      user: '507f1f77bcf86cd799439014',
      status: 'APPROVED',
      paymentDeadline: new Date('2026-09-01T00:00:00.000Z'),
    };
    spyOn(RenewalApprovalRequest, 'findOne').and.resolveTo(request);
    spyOn(Payment, 'findOne').and.resolveTo(null);
    spyOn(RenewalApprovalRequest, 'updateOne').and.resolveTo({ matchedCount: 1 });
    spyOn(Renewal, 'updateOne').and.resolveTo({ matchedCount: 1 });
    spyOn(Policy, 'updateOne').and.resolveTo({ matchedCount: 1 });

    await approvalController.getMyRequest({
      params: { id: requestId },
      user: { id: request.user },
    }, response);

    expect(RenewalApprovalRequest.updateOne).toHaveBeenCalledWith(
      { _id: request._id, status: 'APPROVED' },
      { $set: { status: 'PAYMENT_WINDOW_EXPIRED' } },
    );
    expect(Renewal.updateOne).toHaveBeenCalledWith(
      { _id: request.renewal, status: 'LATE_RENEWAL_APPROVED' },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'EXPIRED' }) }),
    );
    expect(Policy.updateOne).toHaveBeenCalledWith(
      { _id: request.policy },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'EXPIRED' }) }),
    );
    expect(response.json).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'PAYMENT_WINDOW_EXPIRED' }));
  });

  it('keeps normal renewal payment blocked while approval is pending', async () => {
    const response = createResponse();
    spyOn(Renewal, 'findOne').and.resolveTo(makeRenewal('LATE_APPROVAL_PENDING'));

    await paymentController.createRenewalOrder({
      body: { renewalId },
      user: { id: '507f1f77bcf86cd799439014' },
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
  });
});
