import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const AdminLoginPage = () => {
  const { signIn, session, isStaff, roleReady, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/admin/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !session || !roleReady) return;
    if (isStaff) {
      navigate(from, { replace: true });
    } else {
      // Signed in but not staff — show the friendly access-denied page.
      navigate("/access-denied", {
        replace: true,
        state: { reason: "student-tried-admin", from: location.pathname },
      });
    }
  }, [loading, session, roleReady, isStaff, navigate, from, location.pathname]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error("Sign-in failed", { description: error });
      return;
    }
    toast.success("Welcome back");
    // The redirect effect above handles role-based navigation once roleReady
    // flips true (signIn already resolved it server-side).
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" style={{ background: "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 100%)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-black font-display text-white">ARKE</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-card p-6 sm:p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-black font-display text-foreground">Staff Sign In</h1>
            <p className="mt-1 text-sm text-muted-foreground">Access the ARKE enquiries dashboard</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@arke.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Authorised personnel only. All access is logged.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
