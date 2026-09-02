const { protect } = require('../../middleware/authMiddleware');
const requireRole = require('../../middleware/roleMiddleware');

const createResponse = () => ({
  status: jasmine.createSpy('status').and.callFake(function returnResponse() {
    return this;
  }),
  json: jasmine.createSpy('json'),
});

describe('OIDC authorization middleware', () => {
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
