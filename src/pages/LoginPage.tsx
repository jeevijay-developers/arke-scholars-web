import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Phone, Check, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import logoLight from "@/assets/arke-logo-light.png";

const OTP_LENGTH = 6;
type Step = "phone" | "otp";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { session, user, isStaff, isTeacher, isMentor, isLeadManager, roleReady, loading } = useAuth();

  useEffect(() => {
    if (loading || !session || !roleReady) return;
    const mustChange = Boolean(
      (user?.app_metadata as Record<string, unknown> | undefined)?.must_change_password,
    );
    if (mustChange) {
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const updatedAt = user?.updated_at ? new Date(user.updated_at).getTime() : 0;
      const alreadyChanged = createdAt && updatedAt && updatedAt - createdAt > 60_000;
      if (!alreadyChanged) {
        navigate("/auth/change-password", { replace: true });
        return;
      }
      void supabase.functions.invoke("clear-password-flag").then(({ error }) => {
        if (!error) void supabase.auth.refreshSession();
      });
    }
    if (isLeadManager) {
      navigate("/lead-manager/dashboard", { replace: true });
      return;
    }
    if (isStaff) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    const digit = val.replace(/\D/g, "");
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit) focusNext(idx);
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx]) focusPrev(idx);
  };

  const otp = digits.join("");

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }
    navigate("/my-courses", { replace: true });
  }, [loading, session, user, roleReady, isStaff, isTeacher, isMentor, isLeadManager, navigate, redirectTo]);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleResend = async () => {
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("New OTP sent");
    startCooldown();
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const handleVerifyOtp = async () => {
    if (otp.length < OTP_LENGTH) { toast.error("Enter the full 6-digit code"); return; }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: "sms" });
    setVerifying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Session established — auth context useEffect above handles redirect
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden w-[60%] p-12 lg:flex lg:flex-col lg:justify-center" style={{ background: "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 50%, hsl(222 47% 15%) 100%)" }}>
        <div className="mx-auto max-w-md animate-fade-in-up">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoLight} alt="ARKE Logo" className="h-14 rounded-xl" />
          </div>
          <div className="space-y-5 mt-12">
            {["Live classes from top educators", "JEE/NEET test series with rank", "AI doubt solver — available 24/7"].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/30">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{t}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-white/85">Join 50,000+ students already learning</p>
          <p className="mt-4 text-xs text-white/70">Trusted by students across India</p>
          <Sparkles className="mt-8 h-6 w-6 text-accent animate-pulse" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center bg-card p-8">
        <div className="w-full max-w-sm animate-fade-in-up">

          {/* Step 1 — Phone */}
          {step === "phone" && (
            <>
              <Link to="/" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to home
              </Link>
              <h2 className="text-2xl font-black font-display text-foreground">Welcome Back</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your phone number to log in</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Phone Number</label>
                  <div className="mt-1 flex gap-2">
                    <select className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground">
                      <option value="+91">IN +91</option>
                    </select>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        type="tel"
                        placeholder="10-digit number"
                        onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                        className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
                <button onClick={handleSendOtp} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending OTP...</> : "Send OTP"}
                </button>
              </div>
              <div className="mt-6 text-center">
                <span className="text-sm text-muted-foreground">New here? </span>
                <Link to="/signup" className="text-sm font-semibold text-primary hover:text-primary-dark">Create Account →</Link>
              </div>
            </>
          )}

          {/* Step 2 — OTP */}
          {step === "otp" && (
            <>
              <button onClick={() => setStep("phone")} className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Change number
              </button>
              <h2 className="text-2xl font-black font-display text-foreground">Verify Phone</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-semibold text-foreground">{fullPhone}</span>
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={OTP_LENGTH}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className="h-12 w-10 rounded-xl border-2 border-border bg-background text-center text-xl font-bold text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                ))}
              </div>
              <button onClick={handleVerifyOtp} disabled={verifying || otp.length < OTP_LENGTH} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
                {verifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</> : "Verify & Login"}
              </button>
              <button onClick={handleResend} disabled={resending || cooldown > 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 transition-colors">
                <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
