const express = require('express');
const router = express.Router();
const Application = require('../models/Application'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { applyForPlan, getMyApplications } = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware'); 
const requireRole = require('../middleware/roleMiddleware');

const clearanceDirectory = path.join(__dirname, '..', 'uploads', 'medical-clearance');
fs.mkdirSync(clearanceDirectory, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, clearanceDirectory),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
    }),
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        cb(null, allowedTypes.includes(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/apply', protect, upload.single('medicalClearanceDocument'), applyForPlan);

router.get('/my-policies', protect, getMyApplications);

router.get('/admin/all', protect, requireRole('admin'), async (req, res) => {
    try {
        const apps = await Application.find()
            .populate('user', 'name email')
            .populate('plan', 'title premium coverage');
        res.json(apps);
    } catch (err) {
        console.error("Admin Fetch Error:", err);
        res.status(500).json({ msg: "Server Error fetching applications" });
    }
});

router.put('/:id/status', protect, requireRole('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ msg: 'Status must be approved or rejected.' });
        }
        const app = await Application.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        );
        res.json(app);
    } catch (err) {
        res.status(500).json({ msg: "Update failed" });
    }
});

module.exports = router;
