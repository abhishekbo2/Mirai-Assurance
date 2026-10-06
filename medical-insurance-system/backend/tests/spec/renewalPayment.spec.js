const crypto = require('crypto');
const paymentController = require('../../controllers/paymentController');
const Payment = require('../../models/Payment');
const Policy = require('../../models/Policy');
const Renewal = require('../../models/Renewal');
const RenewalApprovalRequest = require('../../models/RenewalApprovalRequest');
const notificationService = require('../../services/policyNotificationService');

const createResponse = () => ({
  status: jasmine.createSpy('status').and.callFake(function returnResponse() {
    return this;
  }),
  json: jasmine.createSpy('json'),
});

const makeRenewal = (status = 'RENEWAL_WINDOW_OPEN') => ({
  _id: 'renewal_1',
  user: 'user_1',
  policy: { _id: 'policy_1' },
  sequence: 1,
  status,
  renewalWindowStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
  gracePeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
  periodStartDate: new Date('2027-01-01T00:00:00.000Z'),
  periodEndDate: new Date('2028-01-01T00:00:00.000Z'),
  premiumAmount: 2750,
  currency: 'INR',
});

const makeRazorpayClient = (payment = { amount: 275000, currency: 'INR', status: 'captured' }) => ({
  orders: { create: jasmine.createSpy('createOrder').and.resolveTo({ id: 'order_1', amount: 275000, currency: 'INR' }) },
  payments: { fetch: jasmine.createSpy('fetchPayment').and.resolveTo(payment) },
});

describe('Normal Renewal Payment', () => {
  let request;
  let response;
  let razorpayClient;
  const originalGetRazorpayClient = paymentController.getRazorpayClient;

  beforeEach(() => {
    request = { body: {}, user: { id: 'user_1' } };
    response = createResponse();
    razorpayClient = makeRazorpayClient();
    paymentController.getRazorpayClient = jasmine.createSpy('getRazorpayClient').and.returnValue(razorpayClient);
    spyOn(notificationService, 'safelyRecordNotification').and.resolveTo(null);
    spyOn(RenewalApprovalRequest, 'findOne').and.resolveTo(null);
    spyOn(RenewalApprovalRequest, 'updateOne').and.resolveTo({ acknowledged: true, matchedCount: 0 });
  });

  afterEach(() => {
    paymentController.getRazorpayClient = originalGetRazorpayClient;
  });

  const configureValidSignature = () => {
    const hmac = jasmine.createSpyObj('hmac', ['update', 'digest']);
    hmac.update.and.returnValue(hmac);
    hmac.digest.and.returnValue('valid_signature');
    spyOn(crypto, 'createHmac').and.returnValue(hmac);
  };

  it('allows payment in the renewal window and uses Renewal.premiumAmount', async () => {
    request.body = { renewalId: 'renewal_1' };
    const renewal = makeRenewal('RENEWAL_WINDOW_OPEN');
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(Payment, 'findOne').and.returnValues(Promise.resolve(null), Promise.resolve(null));
    spyOn(Payment, 'create').and.resolveTo({ _id: 'payment_1' });

    await paymentController.createRenewalOrder(request, response);

    expect(razorpayClient.orders.create).toHaveBeenCalledWith(jasmine.objectContaining({
      amount: 275000,
      currency: 'INR',
    }));
    expect(Payment.create).toHaveBeenCalledWith(jasmine.objectContaining({
      amount: 2750,
      kind: 'RENEWAL',
      renewal: renewal._id,
      status: 'ORDER_CREATED',
    }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('rejects payment before the window and after the grace period', async () => {
    request.body = { renewalId: 'renewal_1' };
    const beforeWindow = makeRenewal('RENEWAL_WINDOW_OPEN');
    beforeWindow.renewalWindowStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const afterGrace = makeRenewal('GRACE_PERIOD');
    afterGrace.gracePeriodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    spyOn(Renewal, 'findOne').and.returnValues(Promise.resolve(beforeWindow), Promise.resolve(afterGrace));

    await paymentController.createRenewalOrder(request, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(razorpayClient.orders.create).not.toHaveBeenCalled();

    response = createResponse();
    await paymentController.createRenewalOrder(request, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(razorpayClient.orders.create).not.toHaveBeenCalled();
  });

  it('rejects an approved late renewal after its payment deadline', async () => {
    request.body = { renewalId: 'renewal_1' };
    spyOn(Renewal, 'findOne').and.resolveTo(makeRenewal('LATE_RENEWAL_APPROVED'));
    RenewalApprovalRequest.findOne.and.resolveTo({
      status: 'APPROVED',
      paymentDeadline: new Date(Date.now() - 1000),
    });

    await paymentController.createRenewalOrder(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(razorpayClient.orders.create).not.toHaveBeenCalled();
  });

  it('completes renewal payment and advances the Policy to the Renewal period', async () => {
    request.body = {
      renewalId: 'renewal_1',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'payment_1',
      razorpay_signature: 'valid_signature',
    };
    const renewal = makeRenewal('GRACE_PERIOD');
    const payment = { _id: 'payment_record_1', providerOrderId: 'order_1', status: 'ORDER_CREATED' };
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(Payment, 'findOne').and.resolveTo(payment);
    spyOn(Payment, 'updateOne').and.resolveTo({ acknowledged: true, matchedCount: 1 });
    spyOn(Policy, 'updateOne').and.resolveTo({ acknowledged: true, matchedCount: 1 });
    spyOn(Renewal, 'updateOne').and.resolveTo({ acknowledged: true, matchedCount: 1 });
    configureValidSignature();

    await paymentController.verifyRenewalPayment(request, response);

    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: payment._id },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'PAID', providerPaymentId: 'payment_1' }) }),
    );
    expect(Policy.updateOne).toHaveBeenCalledWith(
      { _id: 'policy_1', user: 'user_1', renewalSequence: { $lt: 1 } },
      jasmine.objectContaining({
        $set: jasmine.objectContaining({
          currentPeriodStart: renewal.periodStartDate,
          currentPeriodEnd: renewal.periodEndDate,
          nextRenewalDate: renewal.periodEndDate,
          renewalSequence: 1,
          status: 'ACTIVE',
        }),
        $inc: { renewalCount: 1 },
      }),
    );
    expect(Renewal.updateOne).toHaveBeenCalledWith(
      { _id: renewal._id, status: { $in: ['RENEWAL_WINDOW_OPEN', 'GRACE_PERIOD'] } },
      jasmine.objectContaining({ $set: jasmine.objectContaining({ status: 'COMPLETED', paidAt: jasmine.any(Date), completedAt: jasmine.any(Date) }) }),
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('does not extend the Policy or create another Payment on duplicate verification', async () => {
    request.body = {
      renewalId: 'renewal_1',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'payment_1',
      razorpay_signature: 'valid_signature',
    };
    const renewal = makeRenewal('COMPLETED');
    const payment = { providerPaymentId: 'payment_1', providerOrderId: 'order_1', status: 'PAID' };
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(Payment, 'findOne').and.resolveTo(payment);
    spyOn(Policy, 'updateOne');
    spyOn(Payment, 'updateOne');

    await paymentController.verifyRenewalPayment(request, response);

    expect(Policy.updateOne).not.toHaveBeenCalled();
    expect(Payment.updateOne).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('does not extend the Policy for a pending Razorpay payment', async () => {
    request.body = {
      renewalId: 'renewal_1',
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'payment_1',
      razorpay_signature: 'valid_signature',
    };
    const renewal = makeRenewal('RENEWAL_WINDOW_OPEN');
    const payment = { _id: 'payment_record_1', providerOrderId: 'order_1', status: 'ORDER_CREATED' };
    razorpayClient = makeRazorpayClient({ amount: 275000, currency: 'INR', status: 'pending' });
    paymentController.getRazorpayClient.and.returnValue(razorpayClient);
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    spyOn(Payment, 'findOne').and.resolveTo(payment);
    spyOn(Payment, 'updateOne').and.resolveTo({ acknowledged: true, matchedCount: 1 });
    spyOn(Policy, 'updateOne');
    configureValidSignature();

    await paymentController.verifyRenewalPayment(request, response);

    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: payment._id },
      { $set: { status: 'PENDING' } },
    );
    expect(Policy.updateOne).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it('allows an approved late renewal to pay within its seven-day deadline', async () => {
    request.body = { renewalId: 'renewal_1' };
    const renewal = makeRenewal('LATE_RENEWAL_APPROVED');
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    spyOn(Renewal, 'findOne').and.resolveTo(renewal);
    RenewalApprovalRequest.findOne.and.resolveTo({ status: 'APPROVED', paymentDeadline: deadline });
    spyOn(Payment, 'findOne').and.returnValues(Promise.resolve(null), Promise.resolve(null));
    spyOn(Payment, 'create').and.resolveTo({ _id: 'payment_1' });

    await paymentController.createRenewalOrder(request, response);

    expect(razorpayClient.orders.create).toHaveBeenCalledWith(jasmine.objectContaining({ amount: 275000 }));
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
