const Policy = require('../../models/Policy');
const Renewal = require('../../models/Renewal');
const policyController = require('../../controllers/policyController');
const { protect } = require('../../middleware/authMiddleware');

const createResponse = () => ({
  status: jasmine.createSpy('status').and.callFake(function returnResponse() {
    return this;
  }),
  json: jasmine.createSpy('json'),
});

const createQuery = (value) => ({
  populate: jasmine.createSpy('populate').and.callFake(function populate() { return this; }),
  sort: jasmine.createSpy('sort').and.returnValue(Promise.resolve(value)),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const policyId = '507f1f77bcf86cd799439011';
const otherPolicyId = '507f1f77bcf86cd799439012';

const makePolicy = (id = policyId) => ({
  _id: id,
  user: '507f1f77bcf86cd799439021',
  policyNumber: 'POLICY-1',
  status: 'ACTIVE',
  renewalSequence: 0,
  renewalCount: 0,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z'),
  nextRenewalDate: new Date('2027-01-01T00:00:00.000Z'),
  initialPremium: 1250,
  purchasedTerms: { title: 'Gold Plan', premium: 1250 },
});

describe('Customer Policy APIs', () => {
  it('returns only the authenticated customer policies', async () => {
    const response = createResponse();
    const policy = makePolicy();
    const query = createQuery([policy]);
    spyOn(Policy, 'find').and.returnValue(query);

    await policyController.getPolicies({ user: { id: 'user_1' } }, response);

    expect(Policy.find).toHaveBeenCalledWith({ user: 'user_1' });
    expect(response.json).toHaveBeenCalledWith([policy]);
  });

  it('does not return another customer policy by id', async () => {
    const response = createResponse();
    const query = { populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve(null)) };
    spyOn(Policy, 'findOne').and.returnValue(query);

    await policyController.getPolicy({
      params: { id: otherPolicyId },
      user: { id: 'user_1' },
    }, response);

    expect(Policy.findOne).toHaveBeenCalledWith({ _id: otherPolicyId, user: 'user_1' });
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ msg: 'Policy not found.' });
  });

  it('returns an owned policy detail', async () => {
    const response = createResponse();
    const policy = makePolicy();
    const query = { populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve(policy)) };
    spyOn(Policy, 'findOne').and.returnValue(query);

    await policyController.getPolicy({
      params: { id: policyId },
      user: { id: 'user_1' },
    }, response);

    expect(response.json).toHaveBeenCalledWith(policy);
  });

  it('returns date-derived renewal state without creating renewal records', async () => {
    const response = createResponse();
    const policy = makePolicy();
    const query = { populate: jasmine.createSpy('populate').and.returnValue(Promise.resolve(policy)) };
    spyOn(Policy, 'findOne').and.returnValue(query);
    spyOn(Renewal, 'findOne').and.returnValue({
      select: jasmine.createSpy('select').and.returnValue(Promise.resolve(null)),
    });

    await policyController.getRenewalState({
      params: { id: policyId },
      user: { id: 'user_1' },
    }, response);

    const renewalState = response.json.calls.mostRecent().args[0];
    expect(renewalState.renewalState).toBe('NOT_OPEN');
    expect(renewalState.normalRenewalPaymentAllowed).toBe(false);
    expect(renewalState.lateRenewalRequestAllowed).toBe(false);
    expect(renewalState.finallyExpired).toBe(false);
    expect(renewalState.renewalWindowStart).toEqual(new Date('2026-12-02T00:00:00.000Z'));
    expect(renewalState.gracePeriodEnd).toEqual(new Date('2027-01-31T00:00:00.000Z'));
  });

  it('rejects unauthenticated access through the policy route middleware', async () => {
    const response = createResponse();
    const next = jasmine.createSpy('next');

    await protect({ header: () => undefined }, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ msg: 'Authentication token is required.' });
    expect(next).not.toHaveBeenCalled();
  });
});