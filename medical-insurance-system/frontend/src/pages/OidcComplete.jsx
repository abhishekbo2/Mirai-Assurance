import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearOidcEntryPath,
  consumeOidcRegistrationIntent,
  getUserRole,
  isAuthenticated,
  loginWithOidc,
  requireLoginAfterOidcRegistration,
} from "../auth/keycloak";

const OidcComplete = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedDestination = new URLSearchParams(location.search).get("next");
  const isRestartingAfterRegistration = useRef(false);
  const destination = requestedDestination?.startsWith("/")
    ? requestedDestination
    : "/customer-dashboard";

  useEffect(() => {
    if (isAuthenticated()) {
      if (consumeOidcRegistrationIntent()) {
        isRestartingAfterRegistration.current = true;
        requireLoginAfterOidcRegistration(destination).catch(() => {
          navigate("/login", { replace: true });
        });
        return;
      }

      if (isRestartingAfterRegistration.current) return;

      const role = getUserRole();
      clearOidcEntryPath();

      if (role === "admin") {
        navigate("/admin-dashboard", { replace: true });
        return;
      }

      if (role === "customer") {
        navigate(destination, { replace: true });
        return;
      }

      navigate("/", { replace: true });
      return;
    }

    loginWithOidc(destination);
  }, [destination, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <p className="rounded-xl bg-white px-6 py-4 text-center text-gray-700 shadow-lg">
        Completing secure sign in…
      </p>
    </main>
  );
};

export default OidcComplete;
