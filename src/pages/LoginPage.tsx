import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Eye, EyeOff, Check, Sparkles, Globe, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import logoLight from "@/assets/arke-logo-light.png";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { session, user, isStaff, isTeacher, roleReady, loading, signIn } = useAuth();

  // If already authenticated, send to the right portal based on role.
  // Wait until roleReady so a staff/teacher user isn't briefly sent to
  // /dashboard before the role is resolved.
  useEffect(() => {
    if (loading || !session || !roleReady) return;
    const mustChange = Boolean(
      (user?.app_metadata as Record<string, unknown> | undefined)?.must_change_password,
    );
    if (mustChange) {
      // Stale-flag guard: if this user has already updated their password
      // before (auth updated_at > created_at + 60s), the flag is stale.
      // Skip the change-password screen entirely and clear the flag in the
      // background so the dialog never flashes on subsequent logins.
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const updatedAt = user?.updated_at ? new Date(user.updated_at).getTime() : 0;
      const alreadyChanged = createdAt && updatedAt && updatedAt - createdAt > 60_000;
      if (!alreadyChanged) {
        navigate("/auth/change-password", { replace: true });
        return;
      }
      // Fire-and-forget cleanup; do not block navigation on it.
      void supabase.functions.invoke("clear-password-flag").then(({ error }) => {
        if (!error) void supabase.auth.refreshSession();
      });
    }
    if (isStaff) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    if (isTeacher) {
      navigate("/teacher/dashboard", { replace: true });
      return;
    }
    if (redirectTo) {
      navigate(redirectTo, { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  }, [loading, session, user, roleReady, isStaff, isTeacher, navigate, redirectTo]);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { country, setCountry } = useAppStore();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    setSubmitting(true);
    // signIn() resolves the user's role server-side before returning, so the
    // redirect effect above will fire with the correct destination as soon as
    // roleReady flips true.
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error("Could not sign in with Google. Please try again.");
    }
    // Browser will redirect to Google on success
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
          <Link to="/" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          {/* Country Toggle */}
          <div className="flex items-center gap-2 mb-6 rounded-xl border border-border p-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Region:</span>
            <div className="flex rounded-lg bg-background p-0.5 ml-auto">
              <button onClick={() => setCountry('india')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${country === 'india' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                🇮🇳 India
              </button>
              <button onClick={() => setCountry('dubai')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${country === 'dubai' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                🇦🇪 Dubai
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-black font-display text-foreground">Welcome Back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Log in to continue your preparation</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Email Address</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-dark">Forgot Password?</Link>
              </div>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-border bg-card py-2.5 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button onClick={handleEmailLogin} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</> : "Login"}
            </button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or</span></div>
            </div>
            <button onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full rounded-lg border border-border py-3 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              )}
              Sign in with Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <span className="text-sm text-muted-foreground">New here? </span>
            <Link to="/signup" className="text-sm font-semibold text-primary hover:text-primary-dark">Create Account →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
