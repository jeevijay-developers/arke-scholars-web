import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, type UserRole } from "@/context/AuthContext";

type Props = {
  /**
   * Roles that may access the wrapped routes. Listing 'admin' implicitly
   * permits 'super_admin' too (super_admin is a strictly stronger admin).
   */
  allow: UserRole[];
  /**
   * Where to send signed-out users. Staff routes typically use /admin/login;
   * everything else uses /login.
   */
  loginPath?: string;
  /**
   * Optional override for the user's home — defaults to the user's role-based
   * home so a wrong-portal visit gently redirects instead of dead-ending.
   */
  fallbackPath?: string;
};

const homeForRole = (role: UserRole | null): string => {
  switch (role) {
    case "super_admin":
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return "/teacher/dashboard";
    case "mentor":
      return "/mentor/dashboard";
    case "student":
      return "/dashboard";
    default:
      return "/login";
  }
};

/**
 * Generic role-based route guard.
 *
 * - While auth/role data is loading, shows a centered spinner so route content
 *   never flashes wrong-portal UI.
 * - Signed-out users are redirected to `loginPath` (defaults to /login),
 *   preserving the original destination in router state.
 * - Signed-in users whose role isn't in `allow` are redirected to the home of
 *   their actual role so they're never stranded.
 */
const ProtectedRoute = ({ allow, loginPath = "/login", fallbackPath }: Props) => {
  const { session, role, roleReady, loading } = useAuth();
  const location = useLocation();

  if (loading || (session && !roleReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Allowing "admin" implicitly allows "super_admin" (super_admin is a strictly
  // stronger admin), so admin-only routes don't lock out super-admins.
  const effectiveAllow = allow.includes("admin") && !allow.includes("super_admin")
    ? [...allow, "super_admin" as UserRole]
    : allow;

  if (!role || !effectiveAllow.includes(role)) {
    return <Navigate to={fallbackPath ?? homeForRole(role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
