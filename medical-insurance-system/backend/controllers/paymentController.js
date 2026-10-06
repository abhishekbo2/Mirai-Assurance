const Razorpay = require('razorpay');
const crypto = require('crypto');
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Policy = require('../models/Policy');
const Renewal = require('../models/Renewal');
const RenewalApprovalRequest = require('../models/RenewalApprovalRequest');
const notificationService = require('../services/policyNotificationService');

const getRazorpayClient = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured. Check Razorpay environment variables.');
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

const getVerifiedAmount = async (orderId, paymentId) => {
  const razorpay = module.exports.getRazorpayClient();
  const payment = await razorpay.payments.fetch(paymentId);
  if (payment?.amount) {
    return { amount: Number(payment.amount) / 100, currency: payment.currency || 'INR', status: payment.status };
  }

  const order = await razorpay.orders.fetch(orderId);
  if (order?.amount) {
    return { amount: Number(order.amount) / 100, currency: order.currency || 'INR', status: order.status };
  }

  throw new Error('Verified payment amount is unavailable.');
};

const getOwnedRenewal = async (renewalId, userId) => {
  const renewalQuery = Renewal.findOne({ _id: renewalId, user: userId });
  return typeof renewalQuery.populate === 'function'
    ? renewalQuery.populate('policy')
    : renewalQuery;
};

const isNormalRenewalPaymentAllowed = (renewal, now = new Date()) => (
  (renewal.status === 'RENEWAL_WINDOW_OPEN' || renewal.status === 'GRACE_PERIOD')
  && renewal.renewalWindowStart instanceof Date
  && renewal.gracePeriodEnd instanceof Date
  && now >= renewal.renewalWindowStart
  && now <= renewal.gracePeriodEnd
);

const isRenewalPaymentAllowed = async (renewal) => {
  if (isNormalRenewalPaymentAllowed(renewal, new Date())) return true;
  if (renewal.status !== 'LATE_RENEWAL_APPROVED') return false;

  const approvalRequest = await RenewalApprovalRequest.findOne({
    renewal: renewal._id,
    status: 'APPROVED',
  });
  return Boolean(approvalRequest?.paymentDeadline && new Date() <= approvalRequest.paymentDeadline);
};

const createRenewalPayment = async (renewal, userId, amount, currency, orderId) => {
  const idempotencyKey = `renewal:${renewal._id}`;
  const existingPayment = await Payment.findOne({ idempotencyKey });
  if (existingPayment) return existingPayment;

  try {
    return await Payment.create({
      user: userId,
      policy: renewal.policy?._id || renewal.policy,
      renewal: renewal._id,
      kind: 'RENEWAL',
      amount,
      currency,
      status: 'ORDER_CREATED',
      provider: 'razorpay',
      providerOrderId: orderId,
      idempotencyKey,
      initiatedAt: new Date(),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return Payment.findOne({ idempotencyKey });
  }
};

exports.createRenewalOrder = async (req, res) => {
  try {
    const renewal = await getOwnedRenewal(req.body.renewalId, req.user.id);
    if (!renewal) return res.status(404).json({ msg: 'Renewal not found.' });

    if (!(await isRenewalPaymentAllowed(renewal))) {
      return res.status(400).json({ msg: 'Renewal payment is not currently allowed.' });
    }

    const amount = Number(renewal.premiumAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: 'The renewal premium is invalid.' });
    }

    const existingPayment = await Payment.findOne({ idempotencyKey: `renewal:${renewal._id}` });
    if (existingPayment?.status === 'PAID' || renewal.status === 'COMPLETED') {
      return res.status(400).json({ msg: 'This renewal has already been paid.' });
    }
    if (existingPayment?.providerOrderId) {
      return res.status(200).json({
        id: existingPayment.providerOrderId,
        amount: Math.round(amount * 100),
        currency: existingPayment.currency || renewal.currency || 'INR',
        renewalId: renewal._id,
      });
    }

    const currency = renewal.currency || 'INR';
    const order = await module.exports.getRazorpayClient().orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `renewal_${renewal._id}_${Date.now()}`,
    });
    await createRenewalPayment(renewal, req.user.id, amount, currency, order.id);
    res.status(200).json(order);
  } catch (error) {
    console.error('RENEWAL RAZORPAY ERROR:', error);
    res.status(500).json({ msg: 'Razorpay Error', error: error.message });
  }
};

exports.verifyRenewalPayment = async (req, res) => {
  try {
    const { renewalId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const renewal = await getOwnedRenewal(renewalId, req.user.id);
    if (!renewal) return res.status(404).json({ msg: 'Renewal not found.' });

    const payment = await Payment.findOne({
      renewal: renewal._id,
      kind: 'RENEWAL',
    });

    if (renewal.status === 'COMPLETED') {
      if (payment?.providerPaymentId === razorpay_payment_id) {
        return res.status(200).json({ msg: 'Renewal Payment Already Verified', policyId: renewal.policy?._id || renewal.policy });
      }
      return res.status(400).json({ msg: 'This renewal has already been completed.' });
    }

    if (!(await isRenewalPaymentAllowed(renewal))) {
      return res.status(400).json({ msg: 'Renewal payment is not currently allowed.' });
    }
    if (!payment || payment.providerOrderId !== razorpay_order_id) {
      return res.status(400).json({ msg: 'Renewal payment order was not found.' });
    }

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');
    const receivedSignature = Buffer.from(razorpay_signature || '', 'utf8');
    const expectedSignature = Buffer.from(expectedSign, 'utf8');
    const isValidSignature = receivedSignature.length === expectedSignature.length
      && crypto.timingSafeEqual(receivedSignature, expectedSignature);

    if (!isValidSignature) return res.status(400).json({ msg: 'Invalid Signature' });

    const paymentDetails = await getVerifiedAmount(razorpay_order_id, razorpay_payment_id);
    if (paymentDetails.status && paymentDetails.status !== 'captured') {
      const status = paymentDetails.status === 'failed' ? 'FAILED' : 'PENDING';
      const paymentStatusUpdate = { $set: { status } };
      if (status === 'FAILED') {
        paymentStatusUpdate.$set.failureMessage = 'Razorpay payment failed.';
        paymentStatusUpdate.$set.failedAt = new Date();
      }
      await Payment.updateOne(
        { _id: payment._id },
        paymentStatusUpdate,
      );
      return res.status(400).json({ msg: 'Renewal payment is not captured.' });
    }

    const expectedAmount = Number(renewal.premiumAmount);
    if (Math.round(paymentDetails.amount * 100) !== Math.round(expectedAmount * 100)) {
      return res.status(400).json({ msg: 'Renewal payment amount does not match the renewal premium.' });
    }

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: 'PAID',
          providerPaymentId: razorpay_payment_id,
          paidAt: new Date(),
          currency: paymentDetails.currency,
        },
      },
    );

    const policyId = renewal.policy?._id || renewal.policy;
    const policyUpdate = await Policy.updateOne(
      { _id: policyId, user: req.user.id, renewalSequence: { $lt: renewal.sequence } },
      {
        $set: {
          currentPeriodStart: renewal.periodStartDate,
          currentPeriodEnd: renewal.periodEndDate,
          nextRenewalDate: renewal.periodEndDate,
          renewalSequence: renewal.sequence,
          status: 'ACTIVE',
        },
        $inc: { renewalCount: 1 },
      },
    );
    if (!policyUpdate.matchedCount) {
      const currentPolicy = await Policy.findOne({ _id: policyId, user: req.user.id });
      if (!currentPolicy || currentPolicy.renewalSequence !== renewal.sequence) {
        throw new Error('Policy could not be advanced for this renewal.');
      }
    }
    await Renewal.updateOne(
      { _id: renewal._id, status: { $in: ['RENEWAL_WINDOW_OPEN', 'GRACE_PERIOD'] } },
      { $set: { status: 'COMPLETED', paidAt: new Date(), completedAt: new Date() } },
    );
    await Renewal.updateOne(
      { _id: renewal._id, status: 'LATE_RENEWAL_APPROVED' },
      { $set: { status: 'COMPLETED', paidAt: new Date(), completedAt: new Date() } },
    );
    await RenewalApprovalRequest.updateOne(
      { renewal: renewal._id, status: 'APPROVED' },
      { $set: { paidAt: new Date() } },
    );
    await notificationService.safelyRecordNotification({
      type: 'RENEWAL_COMPLETED',
      renewal,
      policy: policyId,
      user: req.user.id,
    });

    res.status(200).json({ msg: 'Renewal Payment Verified', policyId });
  } catch (error) {
    console.error('Renewal payment verification error:', error);
    res.status(500).json({ msg: 'Renewal payment verification failed.' });
  }
};

const addDuration = (startDate, durationValue, durationUnit) => {
  const endDate = new Date(startDate);
  if (durationUnit === 'month') {
    endDate.setMonth(endDate.getMonth() + durationValue);
  } else {
    endDate.setFullYear(endDate.getFullYear() + durationValue);
  }
  return endDate;
};

const createInitialPolicyAndPayment = async (application, paymentDetails, paymentId, orderId) => {
  const existingPolicy = await Policy.findOne({ application: application._id });
  const existingPayment = await Payment.findOne({
    $or: [
      { idempotencyKey: `initial_application:${application._id}` },
      { providerPaymentId: paymentId },
      { providerOrderId: orderId },
    ],
  });

  if (existingPolicy) {
    if (!existingPayment) {
      await Payment.create({
        user: application.user,
        application: application._id,
        policy: existingPolicy._id,
        kind: 'INITIAL_APPLICATION',
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: 'PAID',
        provider: 'razorpay',
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        idempotencyKey: `initial_application:${application._id}`,
        paidAt: application.paymentDate || new Date(),
      });
    }
    return existingPolicy;
  }

  const plan = application.plan;
  if (!plan) {
    throw new Error('Application plan is unavailable.');
  }

  const startDate = application.paymentDate || new Date();
  const durationValue = plan.durationValue || 1;
  const durationUnit = plan.durationUnit || 'year';
  const endDate = addDuration(startDate, durationValue, durationUnit);
  const policyNumber = `POLICY-${application._id.toString().toUpperCase()}`;

  let policy;
  try {
    policy = await Policy.create({
      user: application.user,
      application: application._id,
      plan: plan._id,
      policyNumber,
      status: 'ACTIVE',
      originalStartDate: startDate,
      originalEndDate: endDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      nextRenewalDate: endDate,
      renewalSequence: 0,
      renewalCount: 0,
      initialPremium: paymentDetails.amount,
      currency: paymentDetails.currency,
      purchasedTerms: {
        title: plan.title,
        category: plan.category,
        premium: paymentDetails.amount,
        coverage: plan.coverage,
        coveredConditions: plan.coveredConditions || [],
        terms: plan.terms || '',
        exclusions: plan.exclusions || '',
        networkBenefits: plan.networkBenefits || '',
        durationValue,
        durationUnit,
      },
      historicalSnapshotSource: 'ORIGINAL',
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    policy = await Policy.findOne({ application: application._id });
    if (!policy) throw error;
  }

  if (!existingPayment) {
    try {
      await Payment.create({
        user: application.user,
        application: application._id,
        policy: policy._id,
        kind: 'INITIAL_APPLICATION',
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        status: 'PAID',
        provider: 'razorpay',
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        idempotencyKey: `initial_application:${application._id}`,
        paidAt: application.paymentDate || new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  return policy;
};

exports.createOrder = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.id,
    }).populate('plan', 'premium');

    if (!application) {
      return res.status(404).json({ msg: 'Application not found.' });
    }

    if (application.status !== 'approved' || application.paymentStatus !== 'unpaid') {
      return res.status(400).json({ msg: 'This application is not eligible for payment.' });
    }

    const finalAmount = Number(application.plan?.premium);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ msg: 'The plan premium is invalid.' });
    }

    const options = {
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `application_${application._id}_${Date.now()}`,
    };

    const order = await getRazorpayClient().orders.create(options);
    application.razorpayOrderId = order.id;
    await application.save();
    res.status(200).json(order);
  } catch (err) {
    console.error("RAZORPAY ERROR:", err);
    res.status(500).json({ msg: "Razorpay Error", error: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, applicationId } = req.body;
    const applicationQuery = Application.findOne({
      _id: applicationId,
      user: req.user.id,
    });
    const application = await (typeof applicationQuery.populate === 'function'
      ? applicationQuery.populate('plan')
      : applicationQuery);

    if (!application) {
      return res.status(404).json({ msg: 'Application not found.' });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ msg: 'This application is not eligible for payment verification.' });
    }

    if (application.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ msg: 'Payment order does not match this application.' });
    }

    if (application.paymentStatus === 'paid') {
      if (application.razorpayPaymentId !== razorpay_payment_id) {
        return res.status(400).json({ msg: 'This application has already been paid.' });
      }

      const policy = await Policy.findOne({ application: application._id });
      if (policy) {
        const paymentDetails = await getVerifiedAmount(razorpay_order_id, razorpay_payment_id);
        await createInitialPolicyAndPayment(application, paymentDetails, razorpay_payment_id, razorpay_order_id);
        if (!application.policy) {
          application.policy = policy._id;
          await application.save();
        }
        res.status(200).json({ msg: "Payment Already Verified", policyId: policy._id });
        return;
      }
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    const receivedSignature = Buffer.from(razorpay_signature || '', 'utf8');
    const expectedSignature = Buffer.from(expectedSign, 'utf8');
    const isValidSignature =
      receivedSignature.length === expectedSignature.length &&
      crypto.timingSafeEqual(receivedSignature, expectedSignature);

    if (isValidSignature) {
      const paymentDetails = await getVerifiedAmount(razorpay_order_id, razorpay_payment_id);
      application.paymentStatus = 'paid';
      application.paymentDate = new Date();
      application.razorpayPaymentId = razorpay_payment_id;
      await application.save();
      const policy = await createInitialPolicyAndPayment(application, paymentDetails, razorpay_payment_id, razorpay_order_id);
      application.policy = policy._id;
      await application.save();
      res.status(200).json({ msg: "Payment Verified", policyId: policy._id });
    } else {
      res.status(400).json({ msg: "Invalid Signature" });
    }
  } catch (err) {
    res.status(500).json({ msg: "Verification failed" });
  }
};

module.exports.getRazorpayClient = getRazorpayClient;
