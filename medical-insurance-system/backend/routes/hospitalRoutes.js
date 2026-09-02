const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');

router.get('/', async (req, res) => {
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

module.exports = router;
