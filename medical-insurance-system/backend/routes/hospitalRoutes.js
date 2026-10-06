const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/', async (req, res) => {
    try {
        const hospitals = await Hospital.find({ isActive: { $ne: false } });
        res.json(hospitals);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching hospitals" });
    }
});

router.get('/admin/all', protect, requireRole('admin'), async (req, res) => {
    try {
        const hospitals = await Hospital.find();
        res.json(hospitals);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching hospitals" });
    }
});

router.post('/add', protect, requireRole('admin'), async (req, res) => {
    try {
        const { name, city, address, isNetwork, location, contact } = req.body;

        const newHospital = new Hospital({
            name,
            city,
            address,
            isNetwork,
            location, 
            contact
        });

        await newHospital.save();
        res.status(201).json({ msg: "Hospital added successfully" });
    } catch (err) {
        console.error("ADD ERROR:", err);
        res.status(500).json({ msg: "Server error", details: err.message });
    }
});

router.put('/:id', protect, requireRole('admin'), async (req, res) => {
    try {
        const { name, city, address, isNetwork, location, contact } = req.body;
        const hospital = await Hospital.findByIdAndUpdate(
            req.params.id,
            { name, city, address, isNetwork, location, contact },
            { new: true, runValidators: true },
        );
        if (!hospital) return res.status(404).json({ msg: 'Hospital not found.' });
        res.json({ msg: 'Hospital updated successfully.', hospital });
    } catch (err) {
        res.status(500).json({ msg: 'Unable to update hospital.' });
    }
});

router.patch('/:id/status', protect, requireRole('admin'), async (req, res) => {
    try {
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ msg: 'isActive must be a boolean.' });
        }
        const hospital = await Hospital.findByIdAndUpdate(
            req.params.id,
            { isActive },
            { new: true, runValidators: true },
        );
        if (!hospital) return res.status(404).json({ msg: 'Hospital not found.' });
        res.json({ msg: isActive ? 'Hospital restored.' : 'Hospital removed from availability.', hospital });
    } catch (err) {
        res.status(500).json({ msg: 'Unable to update hospital availability.' });
    }
});

module.exports = router;
