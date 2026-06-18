import { Link, Outlet, useLocation } from "react-router-dom";
import { Heart, Globe, Phone } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEffect } from "react";
import arkeLogoLight from "@/assets/arke-logo-light.png";

const PublicLayout = () => {
  const location = useLocation();
  const { user } = useAppStore();
  const initials = user?.full_name
    ? user.full_name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("")
    : "U";

  const navItems = [
    { label: "JEE", path: "/courses?exam=JEE Main" },
    { label: "NEET", path: "/courses?exam=NEET" },
    { label: "Foundation", path: "/courses?exam=Foundation" },
    { label: "Mentorship", path: "/mentorship" },
    { label: "Contact", path: "/contact" },
    { label: "About Us", path: "/about" },
  ];

  /** Active state that understands the `?exam=` query param used by exam links. */
  const isNavActive = (path: string) => {
    const [pathname, query] = path.split("?");
    if (location.pathname !== pathname) return false;
    if (!query) return true;
    const examParam = new URLSearchParams(query).get("exam");
    const currentExam = new URLSearchParams(location.search).get("exam");
    return examParam === currentExam;
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Region banner */}
      <div className="bg-gradient-to-r from-[#E4B94F] to-[#C99A2E] py-1.5">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4">
          <Globe className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="text-[11px] font-medium text-primary-foreground">Serving students across</span>
          <span className="rounded-full bg-primary-foreground/20 px-3 py-0.5 text-[11px] font-bold text-primary-foreground">🇮🇳 India</span>
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky bg-[hsl(var(--navy))] top-0 z-50 border-b border-white/10 rounded-b-2xl backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-2 md:gap-4 px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src={arkeLogoLight}
              alt="ARKE"
              className="h-8 md:h-9 w-auto object-contain"
            />
          </Link>
          <div className="hidden items-center justify-center gap-8 md:flex flex-1">
            {navItems.map((item) => {
              const active = isNavActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${active ? "text-primary" : "text-white/90 hover:text-white"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <Link to="/contact" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors" aria-label="Contact us">
              <Phone className="h-4 w-4" />
            </Link>
            {user ? (
              <Link
                to="/my-courses"
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
                <Link to="/login" className="hidden text-sm font-semibold text-white/80 hover:text-primary transition-colors sm:block">
                  Login
                </Link>
                <Link
                  to="/login"
                  className="rounded-pill bg-gradient-to-r from-[#E4B94F] to-[#C99A2E] px-3 md:px-5 py-2 text-xs md:text-sm font-bold text-primary-foreground shadow-blue hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile tab strip — sticky below navbar, hidden on desktop */}
      <div className="sticky top-[57px] z-40 md:hidden border-b border-border bg-card/90 backdrop-blur-md overflow-x-auto">
        <div className="flex min-w-max px-2">
          {navItems.map((item) => {
            const active = isNavActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(var(--navy))] py-12 text-white">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src={arkeLogoLight}
                  alt="ARKE"
                  className="h-8 md:h-10 w-auto object-contain"
                />
              </div>
              <p className="text-sm text-white/60">Empowering students across India to achieve their dream exam results.</p>
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
                <p>🇮🇳 Kota, Rajasthan – 324009</p>
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
