import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type Status = "loading" | "success" | "error";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { refreshRole } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const verify = async () => {
      // Supabase puts the access_token in URL hash on email confirm.
      // The client auto-detects the session — we just check it.
      const { data, error } = await supabase.auth.getSession();

      // If the URL contained an error param, surface it.
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription = url.searchParams.get("error_description") || hashParams.get("error_description");

      if (errorDescription) {
        setStatus("error");
        setMessage(errorDescription);
        return;
      }

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (data.session) {
        // Server-verified role lookup so Google sign-in lands in the right
        // portal (staff/admin → /admin/dashboard, students → /dashboard).
        const staff = await refreshRole();
        setStatus("success");
        setMessage("You're signed in. Redirecting...");
        setTimeout(() => navigate(staff ? "/admin/dashboard" : "/dashboard", { replace: true }), 1200);
      } else {
        // No active session yet — the link may still be valid; ask user to log in.
        setStatus("success");
        setMessage("Email verified! Please log in to continue.");
        setTimeout(() => navigate("/login", { replace: true }), 1500);
      }
    };
    verify();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-card p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-elevated">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-black text-foreground">ARKE</span>
        </Link>

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
          {status === "success" && <CheckCircle2 className="h-8 w-8 text-secondary" />}
          {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
        </div>

        <h1 className="mt-5 font-display text-2xl font-black text-foreground">
          {status === "loading" && "Verifying your email..."}
          {status === "success" && "All set!"}
          {status === "error" && "Verification failed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {status === "loading" ? "Just a moment while we confirm your account." : message}
        </p>

        {status === "error" && (
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            Try signing up again
          </Link>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
