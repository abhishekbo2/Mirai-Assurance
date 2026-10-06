const Application = require('../models/Application');
const InsurancePlan = require('../models/InsurancePlan');

exports.applyForPlan = async (req, res) => {
  try {
    const { planId, applicantAge, applicantType = 'individual', healthDeclaration } = req.body;
    const age = Number(applicantAge);

    if (!planId || !['individual', 'family'].includes(applicantType)) {
      return res.status(400).json({ msg: 'Please select an individual or family application.' });
    }

    if (applicantType === 'individual' && (!Number.isInteger(age) || age < 1 || age > 120)) {
      return res.status(400).json({ msg: 'Please provide a valid applicant age.' });
    }

    let declarations;
    try {
      declarations = typeof healthDeclaration === 'string'
        ? JSON.parse(healthDeclaration)
        : healthDeclaration;
    } catch {
      return res.status(400).json({ msg: 'Health declaration is invalid.' });
    }

    if (!declarations || typeof declarations !== 'object') {
      return res.status(400).json({ msg: 'Please complete the health declaration.' });
    }

    const plan = await InsurancePlan.findById(planId);
    if (!plan) return res.status(404).json({ msg: 'Insurance plan not found.' });
    if (plan.isActive === false) {
      return res.status(403).json({ msg: 'This plan is no longer available for new applications.' });
    }

    if (applicantType === 'individual' && (age < plan.minEligibleAge || age > plan.maxEligibleAge)) {
      return res.status(400).json({ msg: `This plan is available only for ages ${plan.minEligibleAge}-${plan.maxEligibleAge}.` });
    }

    const existing = await Application.findOne({ user: req.user.id, plan: planId });
    if (existing) {
        return res.status(400).json({ msg: "You have already applied for this plan" });
    }

    const newApplication = new Application({
      user: req.user.id,
      plan: planId,
      applicantType,
      applicantAge: applicantType === 'individual' ? age : undefined,
      healthDeclaration: declarations,
      medicalClearanceDocument: req.file ? `/uploads/medical-clearance/${req.file.filename}` : null,
      status: 'Pending Admin Approval'
    });

    await newApplication.save();
    res.status(201).json({ msg: "Application submitted successfully", application: newApplication });
  } catch (err) {
    res.status(500).json({ msg: "Server Error during application" });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const apps = await Application.find({ user: req.user.id }).populate('plan');
    res.json(apps);
  } catch (err) {
    res.status(500).json({ msg: "Server Error fetching your plans" });
  }
};
