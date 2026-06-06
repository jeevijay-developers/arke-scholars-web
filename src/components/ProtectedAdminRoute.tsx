import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Guards admin/staff-only routes (everything under /admin/*).
 *
 * Behaviour:
 * - Not signed in → redirect to /admin/login (preserving the original destination).
 * - Signed in but not staff/admin → redirect to the user's correct portal home.
 * - Signed in as staff/admin → render the route.
 *
 * The role check is verified server-side via the `has_role` RPC, so a non-staff
 * user cannot grant themselves admin access by editing local state or URLs.
 */
const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, role, isStaff, roleReady, loading } = useAuth();
  const location = useLocation();

  if (loading || (session && !roleReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!isStaff) {
    // Non-staff: bounce to their correct portal home.
    const home =
      role === "teacher"
        ? "/teacher/dashboard"
        : role === "mentor"
          ? "/mentor/dashboard"
          : "/dashboard";
    return <Navigate to={home} replace />;
  }

  // Mentor role is staff but not admin-panel staff — bounce to mentor portal.
  if (role === "mentor") {
    return <Navigate to="/mentor/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
