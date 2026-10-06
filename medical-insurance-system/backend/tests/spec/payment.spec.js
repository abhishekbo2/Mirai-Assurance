const crypto = require('crypto');
const paymentController = require('../../controllers/paymentController');
const Application = require('../../models/Application');
const Payment = require('../../models/Payment');
const Policy = require('../../models/Policy');

const makePlan = () => ({
  _id: 'plan_1',
  title: 'Gold Plan',
  category: 'Health',
  premium: 999,
  coverage: 100000,
  coveredConditions: ['diabetes'],
  terms: 'Annual cover',
  exclusions: 'Cosmetic procedures',
  networkBenefits: 'Cashless hospitals',
  durationValue: 6,
  durationUnit: 'month',
});

describe('Payment Controller Unit Tests', () => {
  let request;
  let response;
  let razorpayClient;
  const originalGetRazorpayClient = paymentController.getRazorpayClient;

  beforeEach(() => {
    request = { body: {}, user: { id: 'user_123' } };
    response = {
      status: jasmine.createSpy('status').and.callFake(function returnResponse() {
        return this;
      }),
      json: jasmine.createSpy('json'),
    };
    razorpayClient = {
      payments: { fetch: jasmine.createSpy('fetchPayment').and.resolveTo({ amount: 125000, currency: 'INR' }) },
      orders: { fetch: jasmine.createSpy('fetchOrder').and.resolveTo({ amount: 125000, currency: 'INR' }) },
    };
    paymentController.getRazorpayClient = jasmine.createSpy('getRazorpayClient').and.returnValue(razorpayClient);
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

  const makeApplication = () => ({
    _id: 'app_123',
    user: 'user_123',
    plan: makePlan(),
    status: 'approved',
    paymentStatus: 'unpaid',
    razorpayOrderId: 'ord_1',
    save: jasmine.createSpy('save').and.resolveTo(),
  });

  it('marks the application paid, creates a Payment and creates a Policy with the actual paid amount', async () => {
    request.body = {
      applicationId: 'app_123',
      razorpay_order_id: 'ord_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'valid_signature',
    };

    const application = makeApplication();
    const policy = { _id: 'policy_1' };
    spyOn(Application, 'findOne').and.resolveTo(application);
    spyOn(Payment, 'findOne').and.resolveTo(null);
    spyOn(Payment, 'create').and.resolveTo({ _id: 'payment_1' });
    spyOn(Policy, 'findOne').and.resolveTo(null);
    spyOn(Policy, 'create').and.resolveTo(policy);
    configureValidSignature();

    await paymentController.verifyPayment(request, response);

    expect(Application.findOne).toHaveBeenCalledWith({
      _id: 'app_123',
      user: 'user_123',
    });
    expect(application.paymentStatus).toBe('paid');
    expect(application.razorpayPaymentId).toBe('pay_1');
    expect(application.policy).toBe(policy._id);
    expect(Payment.create).toHaveBeenCalledWith(jasmine.objectContaining({
      kind: 'INITIAL_APPLICATION',
      amount: 1250,
      policy: policy._id,
      status: 'PAID',
    }));
    expect(Policy.create).toHaveBeenCalledWith(jasmine.objectContaining({
      initialPremium: 1250,
      status: 'ACTIVE',
      renewalSequence: 0,
      renewalCount: 0,
      purchasedTerms: jasmine.objectContaining({ premium: 1250, durationValue: 6, durationUnit: 'month' }),
    }));
    expect(application.save).toHaveBeenCalledTimes(2);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('does not create duplicate records when the same successful verification is retried', async () => {
    request.body = {
      applicationId: 'app_123',
      razorpay_order_id: 'ord_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'valid_signature',
    };

    const application = makeApplication();
    const policy = { _id: 'policy_1' };
    let policyLookupCount = 0;
    let paymentLookupCount = 0;
    spyOn(Application, 'findOne').and.resolveTo(application);
    spyOn(Policy, 'findOne').and.callFake(() => {
      policyLookupCount += 1;
      return Promise.resolve(policyLookupCount === 1 ? null : policy);
    });
    spyOn(Policy, 'create').and.resolveTo(policy);
    spyOn(Payment, 'findOne').and.callFake(() => {
      paymentLookupCount += 1;
      return Promise.resolve(paymentLookupCount === 1 ? null : { _id: 'payment_1' });
    });
    spyOn(Payment, 'create').and.resolveTo({ _id: 'payment_1' });
    configureValidSignature();

    await paymentController.verifyPayment(request, response);
    await paymentController.verifyPayment(request, response);

    expect(Policy.create).toHaveBeenCalledTimes(1);
    expect(Payment.create).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(jasmine.objectContaining({ msg: 'Payment Already Verified' }));
  });

  it('preserves the existing invalid-signature behavior', async () => {
    request.body = {
      applicationId: 'app_123',
      razorpay_order_id: 'ord_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'invalid_signature',
    };
    const application = makeApplication();
    spyOn(Application, 'findOne').and.resolveTo(application);
    const hmac = jasmine.createSpyObj('hmac', ['update', 'digest']);
    hmac.update.and.returnValue(hmac);
    hmac.digest.and.returnValue('valid_signature');
    spyOn(crypto, 'createHmac').and.returnValue(hmac);

    await paymentController.verifyPayment(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(application.paymentStatus).toBe('unpaid');
  });
});
