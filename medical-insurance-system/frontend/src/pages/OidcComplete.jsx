import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearOidcEntryPath,
  clearFailedOidcAuthentication,
  consumeOidcRegistrationIntent,
  getUserRole,
  isAuthenticated,
  isOidcAuthenticated,
  loginWithOidc,
  requireLoginAfterOidcRegistration,
  getOidcAccessToken,
} from "../auth/keycloak";
import API from "../api";

const OidcComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedDestination = new URLSearchParams(location.search).get("next");
  const linkTransactionId = new URLSearchParams(location.search).get("link_tx");
  const destination = requestedDestination?.startsWith("/")
    ? requestedDestination
    : "/customer-dashboard";

  useEffect(() => {
    if (consumeOidcRegistrationIntent()) {
      requireLoginAfterOidcRegistration(destination, linkTransactionId).catch(() => {
        navigate("/login", { replace: true });
      });
      return;
    }

    if (isAuthenticated()) {
      if (linkTransactionId) {
        getOidcAccessToken()
          .then((oidcToken) => {
            if (!oidcToken) throw new Error("A verified Keycloak session is required.");
            return API.post("/auth/link-oidc", { transactionId: linkTransactionId }, {
              headers: { Authorization: `Bearer ${oidcToken}` },
            });
          })
          .then(() => {
            navigate(destination, { replace: true });
          })
          .catch(() => {
            navigate("/login", { replace: true });
          });
        return;
      }

      const role = getUserRole();
      clearOidcEntryPath();

      if (role === "admin" || role === "customer") {
        const nextPath = role === "admin" ? "/admin-dashboard" : destination;

        if (isOidcAuthenticated()) {
          API.get("/auth/profile")
            .then(() => navigate(nextPath, { replace: true }))
            .catch((requestError) => {
              if (requestError.response?.data?.code === "OIDC_ACCOUNT_LINK_REQUIRED") {
                clearFailedOidcAuthentication();
                navigate("/login?oidc_conflict=1", { replace: true });
                return;
              }

              navigate("/login", { replace: true });
            });
        } else {
          navigate(nextPath, { replace: true });
        }
        return;
      }

      navigate("/", { replace: true });
      return;
    }

    loginWithOidc(destination);
  }, [destination, linkTransactionId, navigate]);

  return null;
};

export default OidcComplete;
