const Application = require('../../models/Application');
const PolicyNotification = require('../../models/PolicyNotification');
const Renewal = require('../../models/Renewal');
const User = require('../../models/User');
const notificationService = require('../../services/policyNotificationService');
const { runRenewalScheduler } = require('../../utils/renewalCron');

describe('Renewal notification scheduler', () => {
  afterEach(() => {
    jasmine.getEnv().allowRespy(true);
  });

  it('does not use the legacy Application renewal email flow', async () => {
    spyOn(Application, 'find');
    spyOn(Renewal, 'find').and.resolveTo([]);
    spyOn(notificationService, 'processPendingNotifications').and.resolveTo();
    spyOn(notificationService, 'processLifecycleNotifications').and.resolveTo();

    await runRenewalScheduler(new Date('2027-08-01T00:00:00.000Z'), jasmine.createSpy('sendEmail'));

    expect(Application.find).not.toHaveBeenCalled();
    expect(notificationService.processPendingNotifications).toHaveBeenCalled();
  });

  it('processes due lifecycle events and pending delivery for every renewal', async () => {
    const renewals = [{ _id: 'renewal_1' }, { _id: 'renewal_2' }];
    spyOn(Renewal, 'find').and.resolveTo(renewals);
    spyOn(notificationService, 'processLifecycleNotifications').and.resolveTo();
    spyOn(notificationService, 'processPendingNotifications').and.resolveTo();

    await runRenewalScheduler(new Date('2027-08-01T00:00:00.000Z'));

    expect(notificationService.processLifecycleNotifications).toHaveBeenCalledTimes(2);
    expect(notificationService.processLifecycleNotifications).toHaveBeenCalledWith(
      renewals[0],
      new Date('2027-08-01T00:00:00.000Z'),
    );
    expect(notificationService.processPendingNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not create or send duplicates across repeated scheduler runs', async () => {
    const stored = new Map();
    const renewal = {
      _id: 'renewal_1',
      policy: 'policy_1',
      user: 'user_1',
      sequence: 1,
      renewalWindowStart: new Date('2027-08-01T00:00:00.000Z'),
      gracePeriodStart: new Date('2027-09-01T00:00:00.000Z'),
      lateRequestEnd: new Date('2027-10-16T00:00:00.000Z'),
      status: 'EXPIRED',
    };
    spyOn(Renewal, 'find').and.resolveTo([renewal]);
    spyOn(PolicyNotification, 'findOne').and.callFake(({ dedupeKey }) => Promise.resolve(stored.get(dedupeKey) || null));
    spyOn(PolicyNotification, 'create').and.callFake((data) => {
      const notification = { ...data, _id: `notification_${stored.size + 1}` };
      stored.set(data.dedupeKey, notification);
      return Promise.resolve(notification);
    });
    spyOn(PolicyNotification, 'find').and.callFake(() => ({
      sort: () => Promise.resolve([...stored.values()].filter(item => item.status === 'PENDING')),
    }));
    spyOn(PolicyNotification, 'updateOne').and.callFake((filter, update) => {
      const notification = [...stored.values()].find(item => item._id === filter._id);
      if (notification?.status !== filter.status) return Promise.resolve({ modifiedCount: 0 });
      Object.assign(notification, update.$set);
      notification.attempts = (notification.attempts || 0) + update.$inc.attempts;
      return Promise.resolve({ modifiedCount: 1 });
    });
    spyOn(User, 'findById').and.returnValue({
      select: () => Promise.resolve({ email: 'customer@example.com' }),
    });
    const sendEmail = jasmine.createSpy('sendEmail').and.resolveTo();
    const now = new Date('2027-10-17T00:00:00.000Z');

    await runRenewalScheduler(now, sendEmail);
    await runRenewalScheduler(now, sendEmail);

    expect(PolicyNotification.create).toHaveBeenCalledTimes(3);
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect([...stored.values()].every(item => item.status === 'SENT')).toBeTrue();
  });
});
