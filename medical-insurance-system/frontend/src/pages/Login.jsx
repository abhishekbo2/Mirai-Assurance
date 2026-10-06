import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import API from "../api";
import { getOidcDashboardPath, isAuthenticated, loginWithOidc, saveLocalSession } from "../auth/keycloak";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const hasOidcConflict = new URLSearchParams(location.search).get("oidc_conflict") === "1";

  useEffect(() => {
    if (isAuthenticated() && !hasOidcConflict) {
      navigate(getOidcDashboardPath(), { replace: true });
    }
  }, [hasOidcConflict, navigate]);

  const handleLocalLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await API.post("/auth/login", { email, password });
      saveLocalSession(data);
      navigate(data.user.role === "admin" ? "/admin-dashboard" : "/customer-dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="text-center text-3xl font-black italic text-blue-800">Mirai Assurance</h1>
        <p className="mt-2 text-center text-gray-600">Sign in to your account</p>
        {hasOidcConflict && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Your Keycloak account is not linked yet.</p>
            <p className="mt-1">Sign in to your existing Mirai account, then choose Link Keycloak Account from your profile.</p>
          </div>
        )}
        <form className="mt-8 space-y-4" onSubmit={handleLocalLogin}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border bg-gray-50 p-3" required />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border bg-gray-50 p-3 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Signing in..." : hasOidcConflict ? "Sign in to existing account" : "Login"}
          </button>
        </form>
        {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}
        <div className="my-6 flex items-center gap-3 text-sm text-gray-500"><span className="h-px flex-1 bg-gray-200" />OR<span className="h-px flex-1 bg-gray-200" /></div>
        <button type="button" onClick={() => loginWithOidc("/customer-dashboard", "/login")} className="w-full rounded-xl border border-blue-600 py-3 font-bold text-blue-700 transition hover:bg-blue-50">
          Continue with Keycloak
        </button>
        <p className="mt-6 text-center text-sm text-gray-600">New to Mirai? <Link to="/signin" className="font-bold text-blue-600 hover:underline">Create an account</Link></p>
      </section>
    </main>
  );
};

export default Login;
