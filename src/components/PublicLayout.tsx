import { Link, Outlet, useLocation } from "react-router-dom";
import { Flame, Heart, Globe, Menu, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";
import arkeLogo from "@/assets/arke-logo.png";

const PublicLayout = () => {
  const location = useLocation();
  const { country, setCountry, user } = useAppStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = user?.full_name
    ? user.full_name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "U";

  const navItems = [
    { label: "Courses", path: "/courses" },
    { label: "Mentorship", path: "/mentorship" },
    { label: "Admission/Scholarship", path: "/admissions" },
    { label: "Association", path: "/association" },
  ];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);

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

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 bg-card border-r border-border shadow-2xl transition-transform duration-300 ease-in-out md:hidden flex flex-col ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <Link to="/" onClick={() => setDrawerOpen(false)} className="flex items-center gap-2">
            <img
              src={arkeLogo}
              alt="ARKE"
              className="h-8 w-auto object-contain"
            />
            
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navItems.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-5 space-y-3">
          {user ? (
            <Link
              to="/dashboard"
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 bg-muted hover:bg-muted/70 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.full_name?.split(" ")[0] || "Account"}</p>
                <p className="text-xs text-muted-foreground">Go to Dashboard</p>
              </div>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-pill border border-border py-2.5 text-center text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-pill bg-gradient-to-r from-primary to-accent py-2.5 text-center text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity"
              >
                Start Free
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-2 md:gap-4 px-4 py-3">
          <button
            className="md:hidden p-1 text-foreground shrink-0"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Open menu"
          >
            {drawerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src={arkeLogo}
              alt="ARKE"
              className="h-8 md:h-9 w-auto object-contain"
            />
          </Link>
          <div className="hidden items-center justify-center gap-8 md:flex flex-1">
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
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-pill border border-border bg-card px-2 py-1 pr-4 hover:border-primary/50 transition-colors"
                aria-label="Go to dashboard"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground overflow-hidden shrink-0">
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
                <Link to="/login" className="hidden xs:text-sm xs:font-semibold xs:text-foreground xs:hover:text-primary xs:transition-colors sm:block">
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="rounded-pill bg-gradient-to-r from-primary to-accent px-3 md:px-5 py-2 text-xs md:text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity whitespace-nowrap"
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
