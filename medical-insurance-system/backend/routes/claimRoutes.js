const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Claim = require('../models/Claim');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

const uploadDir = 'uploads/claims';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

router.post('/file', protect, upload.single('bill'), async (req, res) => {
    try {
        const { applicationId, amount, type } = req.body;
        
        if (!req.file) return res.status(400).json({ msg: "Please upload a bill" });

        const normalizedPath = req.file.path.replace(/\\/g, '/');

        const newClaim = new Claim({
            user: req.user.id,
            policy: applicationId,
            type: type || 'Cashless',
            amount: Number(amount),
            documents: [normalizedPath],
            status: 'Pending'
        });

        await newClaim.save();
        res.status(201).json({ msg: "Claim filed successfully" });
    } catch (err) {
        console.error("DETAILED ERROR:", err);
        res.status(500).json({ msg: "Server Error", details: err.message });
    }
});

router.get('/admin/all', protect, requireRole('admin'), async (req, res) => {
    try {
        const claims = await Claim.find()
            .populate('user', 'name')
            .populate('policy'); 
            
        console.log("Admin Claims Found:", claims.length);
        res.json(claims);
    } catch (err) {
        console.error("ADMIN FETCH ERROR:", err);
        res.status(500).json({ msg: "Error fetching claims" });
    }
});

router.put('/:id/status', protect, requireRole('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        await Claim.findByIdAndUpdate(req.params.id, { status });
        res.json({ msg: "Claim status updated" });
    } catch (err) {
        res.status(500).json({ msg: "Update failed" });
    }
});

router.get('/my-claims', protect, async (req, res) => {
    try {
        const claims = await Claim.find({ user: req.user.id })
            .sort({ createdAt: -1 }); 
            
        res.json(claims);
    } catch (err) {
        console.error("MY-CLAIMS FETCH ERROR:", err);
        res.status(500).json({ msg: "Error fetching your claims" });
    }
});

module.exports = router;
