import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, RefreshCw, CheckCircle2, ArrowLeft, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error("No email provided");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email re-sent");
    }
  };

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
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-black text-foreground">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a verification link to{" "}
          <span className="font-semibold text-foreground">{email || "your inbox"}</span>.
          Click the link to activate your account.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-left">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <p className="text-xs text-muted-foreground">
              The link expires in 24 hours. If you don't see the email, check your spam folder.
            </p>
          </div>
        </div>

        <button
          onClick={handleResend}
          disabled={resending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary py-2.5 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          {resending ? "Sending..." : "Resend verification email"}
        </button>

        <Link
          to="/login"
          className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to login
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
