import Keycloak from "keycloak-js";

const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL;
const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM;
const keycloakClientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;

const missingConfiguration = [
  ["VITE_KEYCLOAK_URL", keycloakUrl],
  ["VITE_KEYCLOAK_REALM", keycloakRealm],
  ["VITE_KEYCLOAK_CLIENT_ID", keycloakClientId],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

const keycloak = new Keycloak({
  url: keycloakUrl,
  realm: keycloakRealm,
  clientId: keycloakClientId,
});

const OIDC_RETURN_PATH_KEY = "oidcReturnPath";
const OIDC_ENTRY_COOKIE = "miraiOidcEntry";
const PROJECT_AUTH_PATHS = new Set(["/login", "/signin"]);
let oidcRegistrationFlowActive = false;
let registrationReauthentication = null;

const hasOidcRegistrationCallback = () =>
  window.location.pathname === "/oidc-complete" &&
  new URLSearchParams(window.location.search).get("oidc_flow") === "registration";

export const initializeAuthentication = async () => {
  if (missingConfiguration.length) {
    throw new Error(
      `Missing Keycloak configuration: ${missingConfiguration.join(", ")}`,
    );
  }

  oidcRegistrationFlowActive = hasOidcRegistrationCallback();

  await keycloak.init({
    onLoad: "check-sso",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });

  // Refresh an existing Keycloak session once at startup. This is important
  // after email verification or an administrator changes a user's realm role.
  // It ensures the access token used by the API has the latest verified-email
  // and role claims before React makes protected requests.
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(-1);
    } catch {
      // The Keycloak SSO session is no longer valid. Clear only the adapter's
      // in-memory token and let the user start a normal OIDC login again.
      keycloak.clearToken();
    }
  }
};

export const getOidcAccessToken = async () => {
  if (!keycloak.authenticated) return null;

  try {
    await keycloak.updateToken(30);
    return keycloak.token;
  } catch {
    return null;
  }
};

export const getLocalSession = () => {
  const token = sessionStorage.getItem('localToken');
  const role = sessionStorage.getItem('localRole');
  return token && role ? { token, role } : null;
};

export const saveLocalSession = ({ token, user }) => {
  sessionStorage.setItem('localToken', token);
  sessionStorage.setItem('localRole', user.role);
};

export const isAuthenticated = () => Boolean(keycloak.authenticated) || Boolean(getLocalSession());

export const isOidcAuthenticated = () => Boolean(keycloak.authenticated);

export const isOidcRegistrationFlowActive = () => oidcRegistrationFlowActive;

export const getUserRole = () => {
  if (keycloak.hasRealmRole("admin")) return "admin";
  if (keycloak.hasRealmRole("customer")) return "customer";
  return getLocalSession()?.role || null;
};

export const getOidcDashboardPath = () =>
  getUserRole() === "admin" ? "/admin-dashboard" : "/customer-dashboard";

export const consumeOidcReturnPath = () => {
  const path = sessionStorage.getItem(OIDC_RETURN_PATH_KEY);
  sessionStorage.removeItem(OIDC_RETURN_PATH_KEY);
  return path?.startsWith("/") ? path : null;
};

const getOidcReturnUrl = (destination, linkTransactionId, registrationFlow = false) => {
  const params = new URLSearchParams({ next: destination });
  if (linkTransactionId) params.set("link_tx", linkTransactionId);
  if (registrationFlow) params.set("oidc_flow", "registration");
  return `${window.location.origin}/oidc-complete?${params.toString()}`;
};

const rememberOidcEntryPath = (entryPath) => {
  const safeEntryPath = PROJECT_AUTH_PATHS.has(entryPath) ? entryPath : "/login";
  const entryUrl = `${window.location.origin}${safeEntryPath}`;
  const secureAttribute = window.location.protocol === "https:" ? "; Secure" : "";

  // This cookie contains only an allow-listed project path. The Keycloak theme
  // uses it only to return from a cancelled authentication attempt; it never
  // contains a token, identity data, or a Keycloak password.
  document.cookie = `${OIDC_ENTRY_COOKIE}=${encodeURIComponent(entryUrl)}; Path=/; SameSite=Lax${secureAttribute}`;
};

export const clearOidcEntryPath = () => {
  document.cookie = `${OIDC_ENTRY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const clearFailedOidcAuthentication = () => {
  keycloak.clearToken();
  sessionStorage.removeItem(OIDC_RETURN_PATH_KEY);
  clearOidcEntryPath();
};

export const consumeOidcRegistrationIntent = () =>
  hasOidcRegistrationCallback();

export const loginWithOidc = async (
  destination = "/customer-dashboard",
  entryPath = "/login",
) => {
  rememberOidcEntryPath(entryPath);
  sessionStorage.setItem(OIDC_RETURN_PATH_KEY, destination);
  await keycloak.login({
    redirectUri: getOidcReturnUrl(destination),
  });
};

export const registerWithOidc = async (destination = "/customer-dashboard", linkTransactionId = null) => {
  rememberOidcEntryPath("/signin");
  sessionStorage.setItem(OIDC_RETURN_PATH_KEY, destination);
  const registrationUrl = await keycloak.createRegisterUrl({
    redirectUri: getOidcReturnUrl(destination, linkTransactionId, true),
  });
  window.location.assign(registrationUrl);
};

export const linkOidcAccount = async (transactionId, destination = "/customer-dashboard") => {
  if (!transactionId) throw new Error("A linking transaction is required.");
  await registerWithOidc(destination, transactionId);
};

export const requireLoginAfterOidcRegistration = async (destination, linkTransactionId = null) => {
  const callbackUrl = window.location.href;
  if (registrationReauthentication?.callbackUrl === callbackUrl) {
    return registrationReauthentication.promise;
  }

  sessionStorage.setItem(OIDC_RETURN_PATH_KEY, destination);
  clearOidcEntryPath();

  // Force credentials after registration instead of reusing the temporary
  // Keycloak SSO session created during registration or email verification.
  const loginPromise = Promise.resolve().then(() => keycloak.login({
    redirectUri: getOidcReturnUrl(destination, linkTransactionId),
    prompt: "login",
  }));
  const guardedLoginPromise = loginPromise.finally(() => {
    if (registrationReauthentication?.promise === guardedLoginPromise) {
      registrationReauthentication = null;
    }
  });
  registrationReauthentication = { callbackUrl, promise: guardedLoginPromise };

  return guardedLoginPromise;
};

export const logout = async () => {
  sessionStorage.removeItem('localToken');
  sessionStorage.removeItem('localRole');
  sessionStorage.removeItem(OIDC_RETURN_PATH_KEY);
  clearOidcEntryPath();

  if (keycloak.authenticated) {
    await keycloak.logout({ redirectUri: window.location.origin });
    return;
  }

  window.location.assign(window.location.origin);
};

export default keycloak;
