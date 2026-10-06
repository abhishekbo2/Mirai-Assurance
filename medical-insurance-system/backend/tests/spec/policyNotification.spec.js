const PolicyNotification = require('../../models/PolicyNotification');
const notificationService = require('../../services/policyNotificationService');

const renewal = {
  _id: 'renewal_1',
  policy: 'policy_1',
  user: 'user_1',
  sequence: 1,
  renewalWindowStart: new Date('2027-08-01T00:00:00.000Z'),
  gracePeriodStart: new Date('2027-09-01T00:00:00.000Z'),
  lateRequestEnd: new Date('2027-10-16T00:00:00.000Z'),
};

describe('Policy notification deduplication', () => {
  it('defines the complete eight-event set and distinct approval decisions', () => {
    expect(notificationService.NOTIFICATION_TYPES).toEqual([
      'RENEWAL_WINDOW_OPENED',
      'GRACE_PERIOD_STARTED',
      'APPROVAL_REQUEST_SUBMITTED',
      'APPROVAL_APPROVED',
      'APPROVAL_REJECTED',
      'PAYMENT_DEADLINE_CREATED',
      'POLICY_EXPIRED',
      'RENEWAL_COMPLETED',
    ]);

    const approvalKey = notificationService.getDedupeKey('APPROVAL_APPROVED', renewal);
    const rejectionKey = notificationService.getDedupeKey('APPROVAL_REJECTED', renewal);
    expect(approvalKey).not.toBe(rejectionKey);
    expect(approvalKey).toContain('APPROVAL_APPROVED');
    expect(rejectionKey).toContain('APPROVAL_REJECTED');
  });

  it('creates each lifecycle notification once when processing is repeated', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      const notification = { ...data, _id: `notification_${stored.size + 1}` };
      stored.set(data.dedupeKey, notification);
      return Promise.resolve(notification);
    });

    const types = [
      'RENEWAL_WINDOW_OPENED',
      'GRACE_PERIOD_STARTED',
      'APPROVAL_REQUEST_SUBMITTED',
      'APPROVAL_APPROVED',
      'APPROVAL_REJECTED',
      'PAYMENT_DEADLINE_CREATED',
      'POLICY_EXPIRED',
      'RENEWAL_COMPLETED',
    ];
    for (const type of types) {
      await notificationService.recordNotification({ type, renewal });
      await notificationService.recordNotification({ type, renewal });
    }

    expect(PolicyNotification.create).toHaveBeenCalledTimes(types.length);
    expect(stored.size).toBe(types.length);
    expect([...stored.values()].every(item => item.status === 'PENDING')).toBe(true);
    expect(new Set([...stored.values()].map(item => item.dedupeKey)).size).toBe(types.length);
  });

  it('creates the renewal-window notification from the stored window start', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      stored.set(data.dedupeKey, data);
      return Promise.resolve(data);
    });

    await notificationService.processLifecycleNotifications(renewal, new Date('2027-08-01T00:00:00.000Z'));
    const notification = [...stored.values()][0];

    expect(notification.type).toBe('RENEWAL_WINDOW_OPENED');
    expect(notification.scheduledFor).toEqual(renewal.renewalWindowStart);
    expect(notification.status).toBe('PENDING');
  });

  it('creates the grace-period notification from the stored grace start', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      stored.set(data.dedupeKey, data);
      return Promise.resolve(data);
    });

    await notificationService.processLifecycleNotifications(renewal, new Date('2027-09-01T00:00:00.000Z'));
    const notification = [...stored.values()].find(item => item.type === 'GRACE_PERIOD_STARTED');

    expect(notification.scheduledFor).toEqual(renewal.gracePeriodStart);
    expect(notification.status).toBe('PENDING');
  });

  it('creates the final-expiry notification from the stored late-request end', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      stored.set(data.dedupeKey, data);
      return Promise.resolve(data);
    });

    await notificationService.processLifecycleNotifications(renewal, new Date('2027-10-17T00:00:00.000Z'));
    const notification = [...stored.values()].find(item => item.type === 'POLICY_EXPIRED');

    expect(notification.scheduledFor).toEqual(renewal.lateRequestEnd);
    expect(notification.status).toBe('PENDING');
  });

  it('does not duplicate lifecycle notifications when processed repeatedly', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      stored.set(data.dedupeKey, data);
      return Promise.resolve(data);
    });

    const now = new Date('2027-10-17T00:00:00.000Z');
    await notificationService.processLifecycleNotifications(renewal, now);
    await notificationService.processLifecycleNotifications(renewal, now);

    expect(PolicyNotification.create).toHaveBeenCalledTimes(3);
    expect([...stored.values()].map(item => item.type)).toEqual([
      'RENEWAL_WINDOW_OPENED',
      'GRACE_PERIOD_STARTED',
      'POLICY_EXPIRED',
    ]);
  });
});

describe('Policy notification delivery', () => {
  const makePendingStore = (notifications) => {
    const stored = new Map(notifications.map((notification) => [notification._id, notification]));
    spyOn(PolicyNotification, 'find').and.callFake(() => ({
      sort: () => Promise.resolve([...stored.values()].filter(item => item.status === 'PENDING')),
    }));
    spyOn(PolicyNotification, 'updateOne').and.callFake((filter, update) => {
      const notification = stored.get(filter._id);
      if (notification?.status !== filter.status) return Promise.resolve({ modifiedCount: 0 });
      if (update.$set) Object.assign(notification, update.$set);
      if (update.$inc) {
        notification.attempts = (notification.attempts || 0) + update.$inc.attempts;
      }
      if (update.$unset) delete notification.lastError;
      return Promise.resolve({ modifiedCount: 1 });
    });
    return stored;
  };

  it('emails a PENDING notification and marks it SENT after delivery', async () => {
    const notification = {
      _id: 'notification_1',
      type: 'RENEWAL_WINDOW_OPENED',
      renewal: 'renewal_1',
      user: { email: 'customer@example.com' },
      status: 'PENDING',
      attempts: 0,
    };
    const stored = makePendingStore([notification]);
    const sendEmail = jasmine.createSpy('sendEmail').and.resolveTo();

    await notificationService.processPendingNotifications(sendEmail);

    expect(sendEmail).toHaveBeenCalledWith(jasmine.objectContaining({
      email: 'customer@example.com',
      subject: 'Renewal window opened',
    }));
    expect(stored.get(notification._id).status).toBe('SENT');
    expect(stored.get(notification._id).sentAt).toEqual(jasmine.any(Date));
  });

  it('does not email a notification that is already SENT', async () => {
    const notification = {
      _id: 'notification_sent',
      type: 'RENEWAL_COMPLETED',
      user: { email: 'customer@example.com' },
      status: 'SENT',
    };
    makePendingStore([notification]);
    const sendEmail = jasmine.createSpy('sendEmail').and.resolveTo();

    await notificationService.processPendingNotifications(sendEmail);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('keeps notification deduplication separate for Renewal #1 and Renewal #2', async () => {
    const stored = new Map();
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      const notification = { ...data, _id: `notification_${stored.size + 1}` };
      stored.set(data.dedupeKey, notification);
      return Promise.resolve(notification);
    });

    await notificationService.recordNotification({ type: 'RENEWAL_WINDOW_OPENED', renewal: { ...renewal, _id: 'renewal_1', sequence: 1 } });
    await notificationService.recordNotification({ type: 'RENEWAL_WINDOW_OPENED', renewal: { ...renewal, _id: 'renewal_2', sequence: 2 } });

    expect(PolicyNotification.create).toHaveBeenCalledTimes(2);
    expect(stored.size).toBe(2);
  });

  it('does not send or create duplicates across repeated processing', async () => {
    const notification = {
      _id: 'notification_repeat',
      type: 'GRACE_PERIOD_STARTED',
      user: { email: 'customer@example.com' },
      status: 'PENDING',
      attempts: 0,
    };
    const stored = makePendingStore([notification]);
    const sendEmail = jasmine.createSpy('sendEmail').and.resolveTo();

    await notificationService.processPendingNotifications(sendEmail);
    await notificationService.processPendingNotifications(sendEmail);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(stored.get(notification._id).status).toBe('SENT');
  });
});