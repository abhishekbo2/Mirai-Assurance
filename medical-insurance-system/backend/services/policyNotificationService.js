const PolicyNotification = require('../models/PolicyNotification');
const User = require('../models/User');
const sendEmail = require('../utils/emailService');

const NOTIFICATION_TYPES = [
  'RENEWAL_WINDOW_OPENED',
  'GRACE_PERIOD_STARTED',
  'APPROVAL_REQUEST_SUBMITTED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'PAYMENT_DEADLINE_CREATED',
  'POLICY_EXPIRED',
  'RENEWAL_COMPLETED',
];

const notificationTypes = {
  RENEWAL_WINDOW_OPENED: {
    subject: 'Renewal window opened',
    message: (notification) => `Your renewal window for renewal #${notification.renewal?.sequence || 'next'} is now open. Please log in to Mirai Assurance to renew your policy.`,
  },
  GRACE_PERIOD_STARTED: {
    subject: 'Policy renewal grace period started',
    message: (notification) => `The grace period for renewal #${notification.renewal?.sequence || 'next'} has started. Please log in to Mirai Assurance to renew your policy.`,
  },
  APPROVAL_REQUEST_SUBMITTED: {
    subject: 'Late renewal request submitted',
    message: () => 'Your late-renewal approval request has been submitted for review.',
  },
  APPROVAL_APPROVED: {
    subject: 'Late renewal request approved',
    message: () => 'Your late-renewal request was approved. Please complete the renewal payment before the deadline shown in your account.',
  },
  APPROVAL_REJECTED: {
    subject: 'Late renewal request rejected',
    message: () => 'Your late-renewal request was rejected. Please review your policy status in Mirai Assurance.',
  },
  PAYMENT_DEADLINE_CREATED: {
    subject: 'Renewal payment deadline created',
    message: () => 'A renewal payment deadline has been created for your approved late-renewal request. Please complete payment before it expires.',
  },
  POLICY_EXPIRED: {
    subject: 'Policy expired',
    message: () => 'Your insurance policy has expired. Please review your policy status in Mirai Assurance.',
  },
  RENEWAL_COMPLETED: {
    subject: 'Renewal payment completed',
    message: () => 'Your renewal payment was completed successfully. Your policy has been updated.',
  },
};

const processingNotifications = new Set();

const getId = (value) => value?._id || value;

const getDedupeKey = (type, renewal) => (
  `${type}:renewal:${getId(renewal)}:sequence:${renewal.sequence}`
);

const recordNotification = async ({ type, renewal, policy, user, scheduledFor }) => {
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new Error(`Unsupported policy notification type: ${type}`);
  }

  const renewalId = getId(renewal);
  const policyId = getId(policy) || getId(renewal.policy);
  const userId = getId(user) || getId(renewal.user) || getId(policy?.user);
  const dedupeKey = getDedupeKey(type, renewal);
  const existing = await PolicyNotification.findOne({ dedupeKey });
  if (existing) return existing;

  try {
    return await PolicyNotification.create({
      user: userId,
      policy: policyId,
      renewal: renewalId,
      type,
      status: 'PENDING',
      scheduledFor,
      attempts: 0,
      dedupeKey,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return PolicyNotification.findOne({ dedupeKey });
  }
};

const safelyRecordNotification = async (details) => {
  try {
    return await recordNotification(details);
  } catch (error) {
    console.error('Policy notification creation error:', error.message);
    return null;
  }
};

const processLifecycleNotifications = async (renewal, now = new Date()) => {
  const notifications = [];
  if (renewal.renewalWindowStart instanceof Date && now >= renewal.renewalWindowStart) {
    notifications.push(await safelyRecordNotification({
      type: 'RENEWAL_WINDOW_OPENED',
      renewal,
      scheduledFor: renewal.renewalWindowStart,
    }));
  }
  if (renewal.gracePeriodStart instanceof Date && now >= renewal.gracePeriodStart) {
    notifications.push(await safelyRecordNotification({
      type: 'GRACE_PERIOD_STARTED',
      renewal,
      scheduledFor: renewal.gracePeriodStart,
    }));
  }
  if (renewal.status === 'EXPIRED'
    || (renewal.lateRequestEnd instanceof Date && now > renewal.lateRequestEnd)) {
    notifications.push(await safelyRecordNotification({
      type: 'POLICY_EXPIRED',
      renewal,
      scheduledFor: renewal.lateRequestEnd,
    }));
  }
  return notifications.filter(Boolean);
};

const sendNotificationEmail = async (notification, emailSender = sendEmail) => {
  const template = notificationTypes[notification.type];
  if (!template) throw new Error(`Unsupported policy notification type: ${notification.type}`);

  const user = notification.user?.email
    ? notification.user
    : await User.findById(notification.user).select('name email');
  if (!user?.email) throw new Error('Policy notification recipient is unavailable.');

  await emailSender({
    email: user.email,
    subject: template.subject,
    message: template.message(notification),
  });
};

const processPendingNotifications = async (emailSender = sendEmail) => {
  const pending = await PolicyNotification.find({ status: 'PENDING' })
    .sort({ scheduledFor: 1, createdAt: 1 });

  for (const notification of pending) {
    const notificationId = getId(notification);
    if (processingNotifications.has(String(notificationId))) continue;
    processingNotifications.add(String(notificationId));

    try {
      await sendNotificationEmail(notification, emailSender);
      await PolicyNotification.updateOne(
        { _id: notificationId, status: 'PENDING' },
        {
          $set: { status: 'SENT', sentAt: new Date() },
          $inc: { attempts: 1 },
          $unset: { lastError: 1 },
        },
      );
    } catch (error) {
      await PolicyNotification.updateOne(
        { _id: notificationId, status: 'PENDING' },
        {
          $set: { lastError: error.message },
          $inc: { attempts: 1 },
        },
      );
      console.error(`Policy notification delivery error: ${error.message}`);
    } finally {
      processingNotifications.delete(String(notificationId));
    }
  }
};

module.exports = {
  NOTIFICATION_TYPES,
  getDedupeKey,
  recordNotification,
  safelyRecordNotification,
  processLifecycleNotifications,
  processPendingNotifications,
  sendNotificationEmail,
};
