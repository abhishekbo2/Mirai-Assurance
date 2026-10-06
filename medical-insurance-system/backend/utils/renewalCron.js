const cron = require('node-cron');
const Renewal = require('../models/Renewal');
const notificationService = require('../services/policyNotificationService');

const runRenewalScheduler = async (now = new Date(), emailSender) => {
    try {
        const renewals = await Renewal.find({});
        for (const renewal of renewals) {
            await notificationService.processLifecycleNotifications(renewal, now);
        }
        await notificationService.processPendingNotifications(emailSender);
    } catch (err) {
        console.error('Renewal notification scheduler error:', err);
    }
};

cron.schedule('* * * * *', runRenewalScheduler);

module.exports = { runRenewalScheduler };