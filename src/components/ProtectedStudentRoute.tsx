import ProtectedRoute from "./ProtectedRoute";

/**
 * Backwards-compatible alias: protects student-only routes.
 * New code should use <ProtectedRoute allow={["student"]} /> directly.
 */
const ProtectedStudentRoute = () => <ProtectedRoute allow={["student"]} />;

export default ProtectedStudentRoute;
