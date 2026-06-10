import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Phone, User, Check, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import logoLight from "@/assets/arke-logo-light.png";

const OTP_LENGTH = 6;
type Step = "phone" | "otp" | "profile";

const FOUNDATION_CLASSES = [
  { value: "8", label: "Class 8" },
  { value: "9", label: "Class 9" },
  { value: "10", label: "Class 10" },
];
const SENIOR_CLASSES = [
  { value: "11", label: "Class 11" },
  { value: "12", label: "Class 12" },
  { value: "dropper", label: "12th Pass (Dropper)" },
];

const SignupPage = () => {
  const navigate = useNavigate();
  const { isStaff, isTeacher, isMentor, isLeadManager } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [countryCode] = useState("+91");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [profile, setProfile] = useState({ full_name: "", target_exam: "JEE", class_level: "11" });
  const [submitting, setSubmitting] = useState(false);

  const fullPhone = `${countryCode}${phone}`;

  const startCooldown = () => {
    setCooldown(60);
    const id = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
  };

  const focusNext = (idx: number) => inputRefs.current[idx + 1]?.focus();
  const focusPrev = (idx: number) => inputRefs.current[idx - 1]?.focus();

  const handleDigitChange = (idx: number, val: string) => {
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
    toast.success("OTP sent to your phone!");
    startCooldown();
    setStep("otp");
  };

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
    setStep("profile");
  };

  const isFoundation = profile.target_exam === "Foundation";
  const classOptions = isFoundation ? FOUNDATION_CLASSES : SENIOR_CLASSES;

  const updateProfile = (k: keyof typeof profile, v: string) =>
    setProfile((p) => {
      if (k === "target_exam") {
        return { ...p, target_exam: v, class_level: v === "Foundation" ? "8" : v === "Boards" ? "10" : "11" };
      }
      return { ...p, [k]: v };
    });

  const handleCompleteProfile = async () => {
    if (!profile.full_name.trim()) { toast.error("Please enter your name"); return; }
    setSubmitting(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").upsert({
        user_id: data.user.id,
        full_name: profile.full_name.trim(),
        phone: fullPhone,
        target_exam: profile.target_exam,
        class_level: profile.class_level,
      }, { onConflict: "user_id" });
    }
    setSubmitting(false);
    toast.success("Welcome to ARKE!");
    if (isStaff) navigate("/admin/dashboard", { replace: true });
    else if (isTeacher) navigate("/teacher/dashboard", { replace: true });
    else if (isMentor) navigate("/mentor/dashboard", { replace: true });
    else if (isLeadManager) navigate("/lead-manager/dashboard", { replace: true });
    else navigate("/my-courses", { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden w-[60%] p-12 lg:flex lg:flex-col lg:justify-center" style={{ background: "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 50%, hsl(222 47% 15%) 100%)" }}>
        <div className="mx-auto max-w-md">
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
          <Sparkles className="mt-8 h-6 w-6 text-accent animate-pulse" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center bg-card p-8 overflow-y-auto">
        <div className="w-full max-w-sm">

          {/* Step 1 — Phone */}
          {step === "phone" && (
            <>
              <Link to="/" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to home
              </Link>
              <h2 className="text-2xl font-black font-display text-foreground">Create Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your phone number to get started</p>
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
              <div className="mt-4 text-center">
                <span className="text-sm text-muted-foreground">Already have an account? </span>
                <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary-dark">Login →</Link>
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
                {verifying ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify OTP"}
              </button>
              <button onClick={handleResend} disabled={resending || cooldown > 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 transition-colors">
                <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
              </button>
            </>
          )}

          {/* Step 3 — Profile */}
          {step === "profile" && (
            <>
              <h2 className="text-2xl font-black font-display text-foreground">Almost there!</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tell us a bit about yourself</p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Full Name</label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={profile.full_name}
                      onChange={(e) => updateProfile("full_name", e.target.value)}
                      type="text"
                      placeholder="Enter your name"
                      className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Target Exam</label>
                    <select value={profile.target_exam} onChange={(e) => updateProfile("target_exam", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                      <option>JEE</option>
                      <option>NEET</option>
                      <option>Foundation</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Class</label>
                    <select value={profile.class_level} onChange={(e) => updateProfile("class_level", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                      {classOptions.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button onClick={handleCompleteProfile} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</> : "Get Started"}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignupPage;
