const Razorpay = require('razorpay');
const crypto = require('crypto');
const Application = require('../models/Application');

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
    const application = await Application.findOne({
      _id: applicationId,
      user: req.user.id,
    });

    if (!application) {
      return res.status(404).json({ msg: 'Application not found.' });
    }

    if (application.status !== 'approved' || application.paymentStatus !== 'unpaid') {
      return res.status(400).json({ msg: 'This application is not eligible for payment verification.' });
    }

    if (application.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ msg: 'Payment order does not match this application.' });
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
      application.paymentStatus = 'paid';
      application.paymentDate = new Date();
      application.razorpayPaymentId = razorpay_payment_id;
      await application.save();
      res.status(200).json({ msg: "Payment Verified" });
    } else {
      res.status(400).json({ msg: "Invalid Signature" });
    }
  } catch (err) {
    res.status(500).json({ msg: "Verification failed" });
  }
};
