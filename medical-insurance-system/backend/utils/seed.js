require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const InsurancePlan = require('../models/InsurancePlan');

const plans = [
    { title: "Star Comprehensive", category: "Family", premium: 18000, coverage: 1000000 },
    { title: "Young Star Plan", category: "Individual", premium: 8000, coverage: 500000 },
    { title: "Senior Citizen Red Carpet", category: "Senior", premium: 25000, coverage: 750000 }
];

const seedDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await InsurancePlan.deleteMany({});
    await InsurancePlan.insertMany(plans);
    console.log("Plans Seeded Successfully");
    process.exit();
};

seedDB();