import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Loader2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoLight from "@/assets/arke-logo-light.png";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/change-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Failed to send reset email. Please try again.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div
        className="hidden w-[60%] p-12 lg:flex lg:flex-col lg:justify-center"
        style={{
          background:
            "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 50%, hsl(222 47% 15%) 100%)",
        }}
      >
        <div className="mx-auto max-w-md animate-fade-in-up">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoLight} alt="ARKE Logo" className="h-14 rounded-xl" />
          </div>

          <div className="space-y-5 mt-12">
            {[
              "Live classes from top educators",
              "JEE/NEET test series with rank",
              "AI doubt solver — available 24/7",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/30">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{t}</span>
              </div>
            ))}
          </div>

          <p className="mt-12 text-sm text-white/85">Join 50,000+ students already learning</p>
          <p className="mt-4 text-xs text-white/70">Trusted by students from India & Dubai</p>

          <Sparkles className="mt-8 h-6 w-6 text-accent animate-pulse" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <div className="w-full max-w-sm animate-fade-in-up">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>

          {sent ? (
            <div className="mt-6 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-black font-display text-foreground">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to{" "}
                <span className="font-semibold text-foreground">{email}</span>. Follow the link in
                the email to set a new password.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't receive it? Check your spam folder or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary font-semibold hover:underline"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black font-display text-foreground">Forgot Password?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </div>

              <div className="mt-6 text-center">
                <span className="text-sm text-muted-foreground">Remember your password? </span>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  Log in →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
