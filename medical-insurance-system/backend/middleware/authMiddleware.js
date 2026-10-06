const jwt = require('jsonwebtoken');
const User = require('../models/User');

let remoteJwks;

const getOidcConfiguration = async () => {
  const { OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URI } = process.env;

  if (!OIDC_ISSUER || !OIDC_AUDIENCE || !OIDC_JWKS_URI) {
    throw new Error('OIDC is not configured. Check OIDC environment variables.');
  }

  const { createRemoteJWKSet, jwtVerify } = await import('jose');
  if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(OIDC_JWKS_URI));

  return { audience: OIDC_AUDIENCE, issuer: OIDC_ISSUER, jwtVerify };
};

const getTrustedOidcRole = (payload) => {
  const realmRoles = payload.realm_access?.roles || [];
  if (realmRoles.includes('admin')) return 'admin';
  if (realmRoles.includes('customer')) return 'customer';
  return null;
};

const setRequestUser = (req, user, authenticationMethod) => {
  req.user = {
    id: user._id.toString(),
    oidcSubject: user.oidcSubject || null,
    oidcIssuer: user.oidcIssuer || null,
    email: user.email,
    role: user.role,
    authenticationMethod,
  };
};

const authenticateLocalToken = async (token, req) => {
  if (!process.env.JWT_SECRET) return false;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.authenticationMethod !== 'local' || !payload.id) return false;

    const user = await User.findById(payload.id);
    if (!user) return false;

    setRequestUser(req, user, 'local');
    return true;
  } catch {
    return false;
  }
};

const verifyOidcAccessToken = async (token) => {
  const { audience, issuer, jwtVerify } = await getOidcConfiguration();
  const { payload } = await jwtVerify(token, remoteJwks, { audience, issuer });
  const role = getTrustedOidcRole(payload);

  if (!role) {
    const error = new Error('A required Keycloak role is missing.');
    error.statusCode = 403;
    throw error;
  }

  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('OIDC token is missing a verified email address or subject.');
  }

  return { payload, role, issuer };
};

const findOrProvisionOidcUser = async (payload, role, issuer) => {
  const email = payload.email?.trim().toLowerCase();
  const name = payload.name || payload.preferred_username || email;

  if (!payload.sub || !email || payload.email_verified !== true) {
    throw new Error('OIDC token is missing a verified email address or subject.');
  }

  let user = await User.findOne({ oidcIssuer: issuer, oidcSubject: payload.sub });
  if (!user) {
    user = await User.findOne({
      oidcSubject: payload.sub,
      $or: [{ oidcIssuer: { $exists: false } }, { oidcIssuer: null }],
    });
  }

  if (user) {
    user.oidcIssuer = issuer;
    user.name = name;
    user.role = role;
    await user.save();
    return user;
  }

  user = await User.findOne({ email }).select('+password');
  if (user) {
    const error = new Error('An account with this email already exists. Please sign in to your existing Mirai account to link your Keycloak account.');
    error.code = 'OIDC_ACCOUNT_LINK_REQUIRED';
    error.statusCode = 409;
    throw error;
  }

  return User.create({
    authProvider: 'oidc',
    oidcSubject: payload.sub,
    oidcIssuer: issuer,
    name,
    email,
    role,
  });
};

const authenticateOidcToken = async (token, req) => {
  const { payload, role, issuer } = await verifyOidcAccessToken(token);

  const user = await findOrProvisionOidcUser(payload, role, issuer);
  setRequestUser(req, user, 'oidc');
};

exports.authenticateLocalToken = authenticateLocalToken;
exports.verifyOidcAccessToken = verifyOidcAccessToken;
exports.findOrProvisionOidcUser = findOrProvisionOidcUser;

exports.protectLocal = async (req, res, next) => {
  const authorization = req.header('X-Local-Authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token || !(await authenticateLocalToken(token, req))) {
    return res.status(401).json({ msg: 'A valid local session is required.' });
  }

  next();
};

exports.protect = async (req, res, next) => {
  const authorization = req.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return res.status(401).json({ msg: 'Authentication token is required.' });
  }

  if (await authenticateLocalToken(token, req)) return next();

  try {
    await authenticateOidcToken(token, req);
    next();
  } catch (error) {
    console.error('Authentication rejected:', error.code || error.name, error.message);
    const isConfigurationError = error.message?.startsWith('OIDC is not configured');
    const missingRole = error.message === 'A required Keycloak role is missing.';
    const accountLinkRequired = error.code === 'OIDC_ACCOUNT_LINK_REQUIRED';
    res.status(isConfigurationError ? 503 : error.statusCode || 401).json({
      code: error.code,
      msg: isConfigurationError || missingRole || accountLinkRequired
        ? error.message
        : 'Invalid or expired authentication token.',
    });
  }
};
