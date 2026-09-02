const Claim = require('../models/Claim');

exports.fileClaim = async (req, res) => {
  try {
    const { policyId, type, amount, hospitalId, bankDetails } = req.body;
    
    const claimData = {
      user: req.user.id,
      policy: policyId,
      type,
      amount
    };

    if (type === 'Cashless') {
      claimData.hospital = hospitalId;
    } else {
      claimData.bankDetails = bankDetails;
    }

    const claim = new Claim(claimData);
    await claim.save();
    
    res.status(201).json({ msg: "Claim submitted successfully", claim });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};