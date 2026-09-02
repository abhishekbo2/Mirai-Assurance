import { Navigate } from "react-router-dom";
import { getUserRole, isAuthenticated } from "../auth/keycloak";

const ProtectedRoute = ({ children, allowedRole }) => {
  const role = getUserRole();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" />;

  return children;
};

export default ProtectedRoute;
