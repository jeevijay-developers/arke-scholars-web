import { Link, Outlet, useLocation } from "react-router-dom";
import { Flame, Heart, Globe } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const PublicLayout = () => {
  const location = useLocation();
  const { country, setCountry, user } = useAppStore();
  const initials = user?.full_name
    ? user.full_name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "U";

  const navItems = [
    { label: "Courses", path: "/courses" },
    { label: "Mentorship", path: "/mentorship" },
    { label: "Admission/Scholarship", path: "/admissions" },
    { label: "Association", path: "/association" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Region banner */}
      <div className="bg-gradient-to-r from-primary to-accent py-1.5">
        <div className="container mx-auto flex items-center justify-center gap-3 px-4">
          <Globe className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-[11px] font-medium text-primary-foreground/80">Choose your region:</span>
          <div className="flex rounded-full bg-primary-foreground/20 p-0.5">
            <button
              onClick={() => setCountry("india")}
              className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-colors ${country === "india" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
            >
              🇮🇳 India
            </button>
            <button
              onClick={() => setCountry("dubai")}
              className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition-colors ${country === "dubai" ? "bg-primary-foreground text-primary" : "text-primary-foreground/80 hover:text-primary-foreground"}`}
            >
              🇦🇪 Dubai
            </button>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-black font-display gradient-text">ARKE</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => {
              const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-pill border border-border bg-card px-2 py-1 pr-4 hover:border-primary/50 transition-colors"
                aria-label="Go to dashboard"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground hidden sm:inline truncate max-w-[120px]">
                  {user.full_name?.split(" ")[0] || "Account"}
                </span>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-pill bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(var(--navy))] py-12 text-white">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                  <Flame className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-black font-display gradient-text">ARKE</span>
              </div>
              <p className="text-sm text-white/60">Empowering students across India & Dubai to achieve their dream exam results.</p>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-3 text-white">Explore</h4>
              <div className="space-y-2">
                {navItems.map((l) => (
                  <Link key={l.path} to={l.path} className="block text-sm text-white/60 hover:text-white/90 transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-3 text-white">Company</h4>
              <div className="space-y-2">
                <Link to="/about" className="block text-sm text-white/60 hover:text-white/90 transition-colors">About Us</Link>
                <Link to="/career" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Careers</Link>
                <Link to="/career" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Join as mentor</Link>
                <Link to="/career" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Join as teacher</Link>
                <Link to="/contact" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Contact</Link>
                <Link to="/privacy" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="block text-sm text-white/60 hover:text-white/90 transition-colors">Terms of Service</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-3 text-white">Reach Us</h4>
              <div className="space-y-2 text-sm text-white/60">
                <p>🇮🇳 New Delhi, India</p>
                <p>🇦🇪 Dubai, UAE</p>
                <p>support@arke.pro</p>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-white/50 flex items-center justify-center gap-1">
              Made with <Heart className="h-3 w-3 text-destructive fill-destructive" /> for Students · © 2026 Arke
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
