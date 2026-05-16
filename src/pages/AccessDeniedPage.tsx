import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type Reason = "student-tried-admin" | "staff-tried-student" | "not-signed-in" | "generic";

const COPY: Record<Reason, { title: string; body: string; icon: typeof ShieldAlert }> = {
  "student-tried-admin": {
    title: "Admin area is staff-only",
    body: "You're signed in as a student, so the admin dashboard isn't available to your account. If you believe you should have admin access, contact your team administrator.",
    icon: ShieldAlert,
  },
  "staff-tried-student": {
    title: "Student portal is for learners",
    body: "Your account has staff/admin privileges, so the student dashboard isn't shown to you. Use the admin dashboard to manage students, content, and settings.",
    icon: ShieldCheck,
  },
  "not-signed-in": {
    title: "Please sign in to continue",
    body: "This page is only available after you sign in. Choose the right portal below to get started.",
    icon: ShieldAlert,
  },
  generic: {
    title: "You don't have access to this page",
    body: "Your current role doesn't allow viewing this page. Head back to your dashboard or sign in with a different account.",
    icon: ShieldAlert,
  },
};

const AccessDeniedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isStaff, signOut } = useAuth();

  const state = (location.state ?? {}) as { reason?: Reason; from?: string };
  const reason: Reason = state.reason ?? (!session ? "not-signed-in" : "generic");
  const attemptedPath = state.from;
  const { title, body, icon: Icon } = COPY[reason];

  const primaryHref = !session ? "/login" : isStaff ? "/admin/dashboard" : "/dashboard";
  const primaryLabel = !session
    ? "Go to login"
    : isStaff
      ? "Open admin dashboard"
      : "Open student dashboard";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-lg animate-fade-in-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-7 w-7 text-destructive" />
        </div>

        <h1 className="mt-5 text-center font-display text-2xl font-black text-foreground">
          {title}
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">{body}</p>

        {attemptedPath && (
          <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
            You tried to open <span className="font-mono text-foreground">{attemptedPath}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Link
            to={primaryHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <LayoutDashboard className="h-4 w-4" />
            {primaryLabel}
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>

          {session && (
            <button
              onClick={handleSignOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out and switch account
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
