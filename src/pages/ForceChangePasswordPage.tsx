import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Flame, Lock, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const ForceChangePasswordPage = () => {
  const navigate = useNavigate();
  const { session, user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);

  // If no session, send to login. If flag is not set, send to dashboard.
  // If the user has already updated their password before (updated_at is well
  // after created_at) but the flag is stale, clear it automatically and exit.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    const mustChange = Boolean(
      (user?.app_metadata as Record<string, unknown> | undefined)?.must_change_password,
    );
    if (!mustChange) {
      navigate("/teacher/dashboard", { replace: true });
      return;
    }

    // Stale-flag recovery: if the auth user was updated more than 60s after
    // creation, they have already changed their password at least once. The
    // edge function call must have failed previously — clear it now.
    const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
    const updatedAt = user?.updated_at ? new Date(user.updated_at).getTime() : 0;
    if (createdAt && updatedAt && updatedAt - createdAt > 60_000) {
      (async () => {
        const { error } = await supabase.functions.invoke("clear-password-flag");
        if (!error) {
          await supabase.auth.refreshSession();
          navigate("/teacher/dashboard", { replace: true });
        }
      })();
    }
  }, [loading, session, user, navigate]);

  const submit = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setSubmitting(false);
      toast.error(updErr.message);
      return;
    }
    const { error: clearErr } = await supabase.functions.invoke("clear-password-flag");
    if (clearErr) {
      // Password was changed but flag wasn't cleared — still proceed but warn.
      toast.error("Password updated, but please refresh if prompted again.");
    } else {
      toast.success("Password updated. Welcome to ARKE!");
    }
    // Refresh session so the new app_metadata is picked up.
    await supabase.auth.refreshSession();
    setSubmitting(false);
    navigate("/teacher/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Flame className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black font-display text-foreground">Set Your Password</h1>
            <p className="text-xs text-muted-foreground">First-time login — choose a secure password</p>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mb-6 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground">
            For security, you must replace the temporary password shared by the ARKE team before continuing.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">New Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              "Set Password & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForceChangePasswordPage;
