import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

/**
 * Wrap any route element with this to require login, and optionally
 * restrict it to a set of roles.
 *
 *   <ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading, isSuspended } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page auth-loading">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isSuspended) {
    return <Navigate to="/suspended" replace />;
  }

  // Profile row hasn't arrived yet (brief moment right after sign-in) — wait rather than bounce.
  if (!profile) {
    return <div className="page auth-loading">Loading…</div>;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default ProtectedRoute;
