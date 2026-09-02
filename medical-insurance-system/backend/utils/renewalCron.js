const cron = require('node-cron');
const Application = require('../models/Application');
const sendEmail = require('./emailService');

cron.schedule('* * * * *', async () => {
    console.log("Checking for policy renewals...");
    
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const expiringPolicies = await Application.find({
            paymentStatus: 'paid',
            status: 'approved',
            paymentDate: { $lte: oneYearAgo } 
        }).populate('user');

        for (const policy of expiringPolicies) {
            const message = `Hello ${policy.user.name}, your insurance policy for ${policy.plan} has reached its 1-year mark. Please log in to Mirai Assurance to renew your premium.`;
            
            await sendEmail({
                email: policy.user.email,
                subject: 'Insurance Renewal Reminder',
                message: message
            });
            
            console.log(`Reminder sent to: ${policy.user.email}`);
        }
    } catch (err) {
        console.error("Cron Job Error:", err);
    }
});