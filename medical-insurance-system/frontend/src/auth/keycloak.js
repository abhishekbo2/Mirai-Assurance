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
const OIDC_REGISTRATION_COOKIE = "miraiOidcRegistration";
const PROJECT_AUTH_PATHS = new Set(["/login", "/signin"]);

export const initializeAuthentication = async () => {
  if (missingConfiguration.length) {
    throw new Error(
      `Missing Keycloak configuration: ${missingConfiguration.join(", ")}`,
    );
  }

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

const getOidcReturnUrl = (destination) => {
  const params = new URLSearchParams({ next: destination });
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

export const consumeOidcRegistrationIntent = () => {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${OIDC_REGISTRATION_COOKIE}=`));

  document.cookie = `${OIDC_REGISTRATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return cookie?.split("=")[1] === "1";
};

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

export const requireLoginAfterOidcRegistration = async (destination) => {
  sessionStorage.setItem(OIDC_RETURN_PATH_KEY, destination);
  clearOidcEntryPath();

  // Registration and email verification can create a temporary Keycloak SSO
  // session. End that session through Keycloak, then return to the OIDC
  // callback so it starts a genuine credential-login request.
  await keycloak.logout({ redirectUri: getOidcReturnUrl(destination) });
};

export const logout = async () => {
  sessionStorage.removeItem('localToken');
  sessionStorage.removeItem('localRole');
  sessionStorage.removeItem(OIDC_RETURN_PATH_KEY);
  clearOidcEntryPath();
  document.cookie = `${OIDC_REGISTRATION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;

  if (keycloak.authenticated) {
    await keycloak.logout({ redirectUri: window.location.origin });
    return;
  }

  window.location.assign(window.location.origin);
};

export default keycloak;
