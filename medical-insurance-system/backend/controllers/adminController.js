const Application = require('../models/Application');
const sendEmail = require('../utils/emailService');
const Claim = require('../models/Claim');

exports.getAllCustomers = async (req, res) => {
  try {
    const User = require('../models/User');
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