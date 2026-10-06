const InsurancePlan = require('../models/InsurancePlan');

exports.getPlans = async (req, res) => {
    try {
        const plans = await InsurancePlan.find({ isActive: { $ne: false } });
        res.status(200).json(plans);
    } catch (err) {
        res.status(500).json({ message: "Server Error fetching plans" });
    }
};

exports.getAdminPlans = async (req, res) => {
    try {
        const plans = await InsurancePlan.find();
        res.status(200).json(plans);
    } catch (err) {
        res.status(500).json({ message: "Server Error fetching plans" });
    }
};

exports.addPlan = async (req, res) => {
    try {
        const { title, category, premium, coverage, minEligibleAge, maxEligibleAge, coveredConditions, terms, exclusions, networkBenefits } = req.body;

        if (Number(minEligibleAge) > Number(maxEligibleAge)) {
            return res.status(400).json({ message: 'Minimum eligible age cannot exceed maximum eligible age.' });
        }
        
        const newPlan = new InsurancePlan({
            title, category, premium, coverage, 
            minEligibleAge: minEligibleAge || 18,
            maxEligibleAge: maxEligibleAge || 65, 
            coveredConditions: Array.isArray(coveredConditions) ? coveredConditions
                : String(coveredConditions || '').split(',').map((condition) => condition.trim()).filter(Boolean),
            terms,
            exclusions,
            networkBenefits
        });

        await newPlan.save();
        res.status(201).json({ message: "Insurance Plan added successfully!", plan: newPlan });
    } catch (err) {
        res.status(500).json({ message: "Error adding insurance plan", error: err.message });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { minEligibleAge, maxEligibleAge, coveredConditions } = req.body;

        if (Number(minEligibleAge) > Number(maxEligibleAge)) {
            return res.status(400).json({ message: 'Minimum eligible age cannot exceed maximum eligible age.' });
        }

        const updates = {
            ...req.body,
            coveredConditions: Array.isArray(coveredConditions)
                ? coveredConditions
                : String(coveredConditions || '').split(',').map((condition) => condition.trim()).filter(Boolean)
        };

        const plan = await InsurancePlan.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!plan) return res.status(404).json({ message: 'Insurance plan not found.' });
        res.json({ message: 'Insurance plan updated successfully!', plan });
    } catch (err) {
        res.status(500).json({ message: 'Error updating insurance plan', error: err.message });
    }
};

exports.setPlanActive = async (req, res) => {
    try {
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: 'isActive must be a boolean.' });
        }

        const plan = await InsurancePlan.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true, runValidators: true },
        );

        if (!plan) return res.status(404).json({ message: 'Insurance plan not found.' });
        res.json({ message: isActive ? 'Insurance plan restored.' : 'Insurance plan removed.', plan });
    } catch (err) {
        res.status(500).json({ message: 'Unable to update insurance plan availability.' });
    }
};
