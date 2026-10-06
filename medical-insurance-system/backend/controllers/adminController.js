const Application = require('../models/Application');
const sendEmail = require('../utils/emailService');
const Claim = require('../models/Claim');
const User = require('../models/User');
const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const Renewal = require('../models/Renewal');
const RenewalApprovalRequest = require('../models/RenewalApprovalRequest');
const Payment = require('../models/Payment');

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.getUnpaidApplications = async (req, res) => {
  try {
    const unpaid = await Application.find({ paymentStatus: 'unpaid' }).populate('user plan');
    res.json(unpaid);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.updateClaimStatus = async (req, res) => {
  try {
    const { claimId, status } = req.body;
    const claim = await Claim.findById(claimId).populate('user');
    if (!claim) return res.status(404).json({ msg: "Claim not found" });

 
    claim.status = status.toLowerCase(); 

    if (claim.status === 'approved' && claim.type === 'Cashless') {
      claim.preAuthApproved = true;
    }

    await claim.save();
    res.json({ msg: `Claim has been ${status} successfully`, claim });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.notifyDefault = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const app = await Application.findById(applicationId).populate('user plan');
    if (!app) return res.status(404).json({ msg: "Not found" });

    await sendEmail({
      email: app.user.email,
      subject: "Premium Overdue",
      message: `Dear ${app.user.name}, please pay for ${app.plan.title}.`
    });

    app.status = 'default';
    await app.save();
    res.json({ msg: "Email sent!" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.getCustomerDetails = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(404).json({ msg: 'Customer not found.' });
  }

  try {
    const [user, applications, claims, policies, renewals, approvalRequests, renewalPayments] = await Promise.all([
      User.findOne({ _id: userId, role: 'customer' }).select(
        'authProvider name email role profileImage',
      ),
      Application.find({ user: userId })
        .select('-razorpayOrderId -razorpayPaymentId')
        .populate('plan', 'title premium coverage'),
      Claim.find({ user: userId })
        .select('-bankDetails')
        .populate('hospital', 'name city address')
        .populate({
          path: 'policy',
          select: 'status paymentStatus plan appliedDate paymentDate',
          populate: { path: 'plan', select: 'title' },
        }),
      Policy.find({ user: userId })
        .populate('plan', 'title category premium coverage durationValue durationUnit')
        .sort({ currentPeriodEnd: -1 }),
      Renewal.find({ user: userId })
        .populate('policy', 'policyNumber')
        .sort({ sequence: -1, periodEndDate: -1 }),
      RenewalApprovalRequest.find({ user: userId })
        .populate('renewal', 'sequence status periodStartDate periodEndDate premiumAmount')
        .sort({ createdAt: -1 }),
      Payment.find({ user: userId, kind: 'RENEWAL' })
        .select('renewal amount currency status providerOrderId providerPaymentId paidAt failedAt')
        .sort({ createdAt: -1 }),
    ]);

    if (!user) return res.status(404).json({ msg: 'Customer not found.' });

    const customer = {
      id: user._id,
      name: user.name,
      email: user.email,
      authProvider: user.authProvider,
      role: user.role,
      hasProfileImage: Boolean(user.profileImage?.data),
    };

    res.json({
      customer,
      applications: applications.map((application) => ({
        id: application._id,
        plan: application.plan,
        status: application.status,
        paymentStatus: application.paymentStatus,
        appliedDate: application.appliedDate,
        paymentDate: application.paymentDate,
        applicantType: application.applicantType,
        applicantAge: application.applicantAge,
        healthDeclaration: application.healthDeclaration,
        medicalClearanceDocument: application.medicalClearanceDocument,
      })),
      claims: claims.map((claim) => ({
        id: claim._id,
        policy: claim.policy,
        type: claim.type,
        hospital: claim.hospital,
        amount: claim.amount,
        status: claim.status,
        documents: claim.documents,
        preAuthApproved: claim.preAuthApproved,
      })),
      policies,
      renewals: renewals.map((renewal) => ({
        ...renewal.toObject(),
        payment: renewalPayments.find((payment) => String(payment.renewal) === String(renewal._id)) || null,
      })),
      lateRenewalRequests: approvalRequests,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to fetch customer details.' });
  }
};