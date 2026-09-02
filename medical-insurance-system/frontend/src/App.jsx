import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import HospitalMap from "./components/HospitalMap";
import AddHospital from "./pages/AddHospital";
import AddPlan from "./pages/AddPlan";
import AdminDashboard from "./pages/AdminDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import FileClaim from "./pages/FileClaim";
import Landingpage from "./pages/Landingpage";
import Login from "./pages/Login";
import MyClaims from "./pages/MyClaims";
import MyPolicies from "./pages/MyPolicies";
import OidcComplete from "./pages/OidcComplete";
import SignIn from "./pages/SignIn";
import { getUserRole, isOidcAuthenticated } from "./auth/keycloak";

const CustomerRoute = ({ children }) => (
  <ProtectedRoute allowedRole="customer">{children}</ProtectedRoute>
);

const AdminRoute = ({ children }) => (
  <ProtectedRoute allowedRole="admin">{children}</ProtectedRoute>
);

const HomeRoute = () => {
  if (!isOidcAuthenticated()) {
    return <Landingpage />;
  }

  const role = getUserRole();

  if (role === "admin") {
    return <Navigate to="/admin-dashboard" replace />;
  }

  if (role === "customer") {
    return <Navigate to="/customer-dashboard" replace />;
  }

  return (
    <section className="mx-auto mt-16 max-w-xl rounded-xl bg-white p-6 text-center shadow-lg">
      <h1 className="text-xl font-bold text-blue-800">Account role is not available</h1>
      <p className="mt-3 text-gray-600">
        Your Keycloak sign-in succeeded, but the access token does not contain a
        customer or admin role. Sign out, then sign in again to refresh your token.
      </p>
    </section>
  );
};

function App() {
  return (
    <Router>
      <Navbar />
      <main className="container mx-auto mt-4 px-4">
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oidc-complete" element={<OidcComplete />} />
          <Route
            path="/customer-dashboard"
            element={<CustomerRoute><CustomerDashboard /></CustomerRoute>}
          />
          <Route path="/my-claims" element={<CustomerRoute><MyClaims /></CustomerRoute>} />
          <Route path="/file-claim" element={<CustomerRoute><FileClaim /></CustomerRoute>} />
          <Route path="/hospitals" element={<CustomerRoute><HospitalMap /></CustomerRoute>} />
          <Route path="/my-policies" element={<CustomerRoute><MyPolicies /></CustomerRoute>} />
          <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/add-hospital" element={<AdminRoute><AddHospital /></AdminRoute>} />
          <Route path="/add-plan" element={<AdminRoute><AddPlan /></AdminRoute>} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
