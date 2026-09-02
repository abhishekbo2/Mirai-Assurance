import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import API from "../api";
import { loginWithOidc } from "../auth/keycloak";

const SignIn = () => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const updateField = (field) => (event) => setFormData((current) => ({ ...current, [field]: event.target.value }));

  const handleLocalRegistration = async (event) => {
    event.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await API.post("/auth/register", formData);
      navigate("/login");
    } catch (requestError) {
      setError(requestError.response?.data?.msg || "Unable to create the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="text-center text-3xl font-black italic text-blue-800">Create account</h1>
        <form className="mt-7 space-y-3" onSubmit={handleLocalRegistration}>
          <input value={formData.name} onChange={updateField("name")} placeholder="Full name" className="w-full rounded-xl border bg-gray-50 p-3" required />
          <input type="email" value={formData.email} onChange={updateField("email")} placeholder="Email address" className="w-full rounded-xl border bg-gray-50 p-3" required />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={updateField("password")}
              placeholder="Password (at least 6 characters)"
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
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={updateField("confirmPassword")}
              placeholder="Confirm password"
              className="w-full rounded-xl border bg-gray-50 p-3 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-700"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-60">{loading ? "Creating account..." : "Register"}</button>
        </form>
        {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}
        <div className="my-6 flex items-center gap-3 text-sm text-gray-500"><span className="h-px flex-1 bg-gray-200" />OR<span className="h-px flex-1 bg-gray-200" /></div>
        <button type="button" onClick={() => loginWithOidc("/customer-dashboard", "/signin")} className="w-full rounded-xl border border-blue-600 py-3 font-bold text-blue-700 transition hover:bg-blue-50">Continue with Keycloak</button>
        <p className="mt-6 text-center text-sm text-gray-600">Already registered? <Link to="/login" className="font-bold text-blue-600 hover:underline">Sign in</Link></p>
      </section>
    </main>
  );
};

export default SignIn;
