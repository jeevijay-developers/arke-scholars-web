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
  const { session, isStaff, role, signOut } = useAuth();

  const state = (location.state ?? {}) as { reason?: Reason; from?: string };
  const reason: Reason = state.reason ?? (!session ? "not-signed-in" : "generic");
  const attemptedPath = state.from;
  
  let { title, body, icon: Icon } = COPY[reason];

  let primaryHref = !session ? "/login" : isStaff ? "/admin/dashboard" : "/dashboard";
  let primaryLabel = !session
    ? "Go to login"
    : isStaff
      ? "Open admin dashboard"
      : "Open student dashboard";

  if (session && role) {
    if (role === "teacher") {
      title = "Move to teacher's dashboard";
      body = "You are signed in as a teacher, so this area isn't available. Go to your dashboard to manage live classes and doubts.";
      primaryHref = "/teacher/dashboard";
      primaryLabel = "Move to teacher's dashboard";
    } else if (role === "mentor") {
      title = "Move to mentor's dashboard";
      body = "You are signed in as a mentor, so this area isn't available. Go to your dashboard to manage your students.";
      primaryHref = "/mentor/dashboard";
      primaryLabel = "Move to mentor's dashboard";
    } else if (role === "student") {
      title = "Move to student's dashboard";
      body = "You are signed in as a student, so this area isn't available. Go to your student dashboard to learn.";
      primaryHref = "/dashboard";
      primaryLabel = "Move to student's dashboard";
    } else if (role === "admin" || role === "super_admin" || role === "lead_manager") {
      title = "Move to admin's dashboard";
      body = "You have staff privileges, so this area isn't available. Go to the admin dashboard to manage settings.";
      primaryHref = "/admin/dashboard";
      primaryLabel = "Move to admin's dashboard";
    }
  }

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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#F97415] px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
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
