const User = require('../../models/User');
const { findOrProvisionOidcUser, protect } = require('../../middleware/authMiddleware');
const requireRole = require('../../middleware/roleMiddleware');

const createResponse = () => ({
  status: jasmine.createSpy('status').and.callFake(function returnResponse() {
    return this;
  }),
  json: jasmine.createSpy('json'),
});

describe('OIDC authorization middleware', () => {
  it('signals explicit linking when a verified OIDC email belongs to a local account', async () => {
    const localAccountQuery = {
      select: jasmine.createSpy('select').and.returnValue(Promise.resolve({ password: 'hash' })),
    };
    spyOn(User, 'findOne').and.returnValues(
      Promise.resolve(null),
      Promise.resolve(null),
      localAccountQuery,
    );

    let error;
    try {
      await findOrProvisionOidcUser(
        { sub: 'keycloak-subject', email: 'local@example.com', email_verified: true },
        'customer',
        'http://issuer.example/realm',
      );
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error.code).toBe('OIDC_ACCOUNT_LINK_REQUIRED');
    expect(error.statusCode).toBe(409);
    expect(User.findOne).toHaveBeenCalledTimes(3);
  });

  it('rejects a request without a Bearer access token', async () => {
    const response = createResponse();
    const request = { header: () => undefined };
    const next = jasmine.createSpy('next');

    await protect(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      msg: 'Authentication token is required.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows only the role required by a route', () => {
    const response = createResponse();
    const next = jasmine.createSpy('next');
    const middleware = requireRole('admin');

    middleware({ user: { role: 'customer' } }, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
