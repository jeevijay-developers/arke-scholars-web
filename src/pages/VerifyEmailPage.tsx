import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, ArrowLeft, Flame, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const OTP_LENGTH = 6;

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // countdown timer after resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const focusNext = (idx: number) => inputRefs.current[idx + 1]?.focus();
  const focusPrev = (idx: number) => inputRefs.current[idx - 1]?.focus();

  const handleChange = (idx: number, val: string) => {
    // Allow paste of full OTP code
    if (val.length > 1) {
      const pasted = val.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const next = [...digits];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setDigits(next);
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
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

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) {
      toast.error("Enter the full 6-digit code");
      return;
    }
    if (!email) {
      toast.error("Email not found. Please sign up again.");
      return;
    }
    setVerifying(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      setVerifying(false);
      toast.error(error.message || "Invalid or expired OTP. Try again.");
      return;
    }

    // OTP verified — set password and profile from the pending signup data
    const raw = sessionStorage.getItem("pending_signup");
    if (raw && data.session) {
      try {
        const pending = JSON.parse(raw) as {
          password: string;
          full_name: string;
          phone: string;
          target_exam: string;
          class_level: string;
          city: string;
          state: string;
          country: string;
        };

        // Set the password so the user can log in with email + password later
        if (pending.password) {
          await supabase.auth.updateUser({ password: pending.password });
        }

        // Upsert profile row
        await supabase.from("profiles").upsert({
          user_id: data.session.user.id,
          full_name: pending.full_name,
          phone: pending.phone,
          target_exam: pending.target_exam,
          class_level: pending.class_level,
          city: pending.city,
          state: pending.state,
          country: pending.country,
        });

        sessionStorage.removeItem("pending_signup");
      } catch {
        // Profile save errors are non-fatal — user is authenticated
      }
    }

    setVerifying(false);
    toast.success("Email verified! Welcome aboard 🎉");
    navigate("/dashboard");
  };

  const handleResend = async () => {
    if (!email) {
      toast.error("No email found. Please sign up again.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("New OTP sent to your email");
      setCooldown(60);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-card p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-elevated">
        <div className="flex justify-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-black text-foreground">ARKE</span>
          </Link>
        </div>

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <h1 className="mt-5 text-center font-display text-2xl font-black text-foreground">Verify your email</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-foreground">{email || "your inbox"}</span>.
          <br />Enter it below to activate your account.
        </p>

        {/* OTP input grid */}
        <div className="mt-7 flex items-center justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className="h-12 w-10 rounded-xl border-2 border-border bg-background text-center text-xl font-bold text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying || otp.length < OTP_LENGTH}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97415] py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {verifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify & Continue"}
        </button>

        <button
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
        </button>

        <Link
          to="/signup"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign up
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
