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

const findOrProvisionOidcUser = async (payload, role) => {
  const email = payload.email?.trim().toLowerCase();
  const name = payload.name || payload.preferred_username || email;

  if (!payload.sub || !email || payload.email_verified !== true) {
    throw new Error('OIDC token is missing a verified email address or subject.');
  }

  let user = await User.findOne({ oidcSubject: payload.sub });
  if (user) {
    user.name = name;
    user.role = role;
    await user.save();
    return user;
  }

  user = await User.findOne({ email }).select('+password');
  if (user) {
    if (user.oidcSubject && user.oidcSubject !== payload.sub) {
      throw new Error('This email is already linked to a different OIDC identity.');
    }

    user.oidcSubject = payload.sub;
    user.authProvider = user.password ? 'hybrid' : 'oidc';
    user.name = name;
    user.role = role;
    await user.save();
    return user;
  }

  return User.create({
    authProvider: 'oidc',
    oidcSubject: payload.sub,
    name,
    email,
    role,
  });
};

const authenticateOidcToken = async (token, req) => {
  const { audience, issuer, jwtVerify } = await getOidcConfiguration();
  const { payload } = await jwtVerify(token, remoteJwks, { audience, issuer });
  const role = getTrustedOidcRole(payload);

  if (!role) {
    const error = new Error('A required Keycloak role is missing.');
    error.statusCode = 403;
    throw error;
  }

  const user = await findOrProvisionOidcUser(payload, role);
  setRequestUser(req, user, 'oidc');
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
    res.status(isConfigurationError ? 503 : error.statusCode || 401).json({
      msg: isConfigurationError || missingRole
        ? error.message
        : 'Invalid or expired authentication token.',
    });
  }
};
