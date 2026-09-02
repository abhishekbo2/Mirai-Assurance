const crypto = require('crypto');
const paymentController = require('../../controllers/paymentController');
const Application = require('../../models/Application');

describe('Payment Controller Unit Tests', () => {
  let request;
  let response;

  beforeEach(() => {
    request = { body: {}, user: { id: 'user_123' } };
    response = {
      status: jasmine.createSpy('status').and.callFake(function returnResponse() {
        return this;
      }),
      json: jasmine.createSpy('json'),
    };
  });

  it('marks only the user’s approved, unpaid application as paid after valid HMAC verification', async () => {
    request.body = {
      applicationId: 'app_123',
      razorpay_order_id: 'ord_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'valid_signature',
    };

    const application = {
      status: 'approved',
      paymentStatus: 'unpaid',
      razorpayOrderId: 'ord_1',
      save: jasmine.createSpy('save').and.resolveTo(),
    };
    spyOn(Application, 'findOne').and.resolveTo(application);

    const hmac = jasmine.createSpyObj('hmac', ['update', 'digest']);
    hmac.update.and.returnValue(hmac);
    hmac.digest.and.returnValue('valid_signature');
    spyOn(crypto, 'createHmac').and.returnValue(hmac);

    await paymentController.verifyPayment(request, response);

    expect(Application.findOne).toHaveBeenCalledWith({
      _id: 'app_123',
      user: 'user_123',
    });
    expect(application.paymentStatus).toBe('paid');
    expect(application.razorpayPaymentId).toBe('pay_1');
    expect(application.save).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
