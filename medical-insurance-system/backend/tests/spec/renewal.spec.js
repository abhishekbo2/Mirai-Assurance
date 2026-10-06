const Renewal = require('../../models/Renewal');
const {
  getRenewalDates,
  getInitialRenewalStatus,
  buildRenewalData,
  processPolicy,
  totals,
} = require('../../scripts/createRenewals');

const policy = {
  _id: '507f1f77bcf86cd799439011',
  user: '507f1f77bcf86cd799439021',
  status: 'ACTIVE',
  renewalSequence: 0,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z'),
  currency: 'INR',
  purchasedTerms: {
    title: 'Gold Plan',
    category: 'Health',
    premium: 1250,
    coverage: 100000,
    coveredConditions: ['diabetes'],
    terms: 'Annual cover',
    exclusions: 'Cosmetic procedures',
    networkBenefits: 'Cashless hospitals',
    durationValue: 1,
    durationUnit: 'year',
  },
};

const queryFor = (value) => ({
  select: jasmine.createSpy('select').and.returnValue(Promise.resolve(value)),
});

describe('Renewal cycle initialization', () => {
  beforeEach(() => {
    Object.keys(totals).forEach((key) => { totals[key] = 0; });
  });

  it('anchors the cycle to the scheduled policy period with the required windows', () => {
    const dates = getRenewalDates(policy.currentPeriodEnd);

    expect(dates.renewalWindowStart).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    expect(dates.renewalWindowEnd).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(dates.gracePeriodStart).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(dates.gracePeriodEnd).toEqual(new Date('2027-01-16T00:00:00.000Z'));
    expect(dates.lateRequestStart).toEqual(new Date('2027-01-16T00:00:00.000Z'));
    expect(dates.lateRequestEnd).toEqual(new Date('2027-02-16T00:00:00.000Z'));
  });

  it('sets lifecycle status consistently at each date boundary', () => {
    const dates = getRenewalDates(policy.currentPeriodEnd);

    expect(getInitialRenewalStatus(dates, new Date('2026-11-30T23:59:59.999Z'))).toBe('NOT_OPEN');
    expect(getInitialRenewalStatus(dates, new Date('2026-12-01T00:00:00.000Z'))).toBe('RENEWAL_WINDOW_OPEN');
    expect(getInitialRenewalStatus(dates, new Date('2027-01-01T00:00:00.000Z'))).toBe('GRACE_PERIOD');
    expect(getInitialRenewalStatus(dates, new Date('2027-01-16T00:00:00.000Z'))).toBe('LATE_APPROVAL_REQUIRED');
    expect(getInitialRenewalStatus(dates, new Date('2027-02-16T00:00:00.000Z'))).toBe('LATE_APPROVAL_REQUIRED');
    expect(getInitialRenewalStatus(dates, new Date('2027-02-16T00:00:00.001Z'))).toBe('EXPIRED');
  });

  it('uses the immutable Policy snapshot and scheduled dates when building sequence one', () => {
    const renewal = buildRenewalData(policy, new Date('2026-09-09T00:00:00.000Z'));

    expect(renewal.sequence).toBe(1);
    expect(renewal.premiumAmount).toBe(1250);
    expect(renewal.planSnapshot).toEqual(policy.purchasedTerms);
    expect(renewal.periodStartDate).toEqual(policy.currentPeriodStart);
    expect(renewal.periodEndDate).toEqual(policy.currentPeriodEnd);
    expect(renewal.status).toBe('NOT_OPEN');
  });

  it('increments the Policy renewal sequence', () => {
    const renewal = buildRenewalData({ ...policy, renewalSequence: 4 });

    expect(renewal.sequence).toBe(5);
  });

  it('creates one Renewal and skips the same policy sequence on rerun', async () => {
    const created = { _id: 'renewal_1', sequence: 1 };
    spyOn(Renewal, 'findOne').and.returnValues(queryFor(null), queryFor(created));
    spyOn(Renewal, 'create').and.resolveTo(created);

    await processPolicy(policy, new Date('2026-09-09T00:00:00.000Z'));
    await processPolicy(policy, new Date('2026-09-09T00:00:00.000Z'));

    expect(Renewal.create).toHaveBeenCalledTimes(1);
    expect(Renewal.create).toHaveBeenCalledWith(jasmine.objectContaining({
      policy: policy._id,
      sequence: 1,
      premiumAmount: policy.purchasedTerms.premium,
      periodStartDate: policy.currentPeriodStart,
      periodEndDate: policy.currentPeriodEnd,
    }));
    expect(totals.skipped).toBe(1);
  });
});