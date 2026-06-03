import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Video, MessageCircle, Settings, Search, Menu, X } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { memo, useEffect, useMemo, useState } from "react";
import arkeLogo from "@/assets/arke-logo.png";
import { useAppStore } from "@/store/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type NavItem = { label: string; icon: typeof Home; path: string; badge?: number };

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Avatar = ({ url, initials, className }: { url?: string; initials: string; className: string }) => (
  <div className={`overflow-hidden ${className}`}>
    {url ? <img src={url} alt={initials} className="h-full w-full object-cover" /> : <span>{initials}</span>}
  </div>
);

const TeacherSidebar = memo(({ pendingDoubts, displayName, initials, avatarUrl, onLogout }: { pendingDoubts: number; displayName: string; initials: string; avatarUrl?: string; onLogout: () => void }) => {
  const location = useLocation();
  // Teacher portal is intentionally minimal: live classes + doubts only.
  // Course/test/student/analytics management is owned by the admin portal.
  const navItems: NavItem[] = [
    { label: "Dashboard", icon: Home, path: "/teacher/dashboard" },
    { label: "Live Classes", icon: Video, path: "/teacher/live-classes" },
    { label: "Doubt Queue", icon: MessageCircle, path: "/teacher/doubts", badge: pendingDoubts },
    { label: "Settings", icon: Settings, path: "/teacher/settings" },
  ];

  return (
    <aside className="hidden lg:flex w-[220px] flex-col border-r border-border bg-card sticky top-0 h-screen overflow-y-auto">
      <div className="p-4 flex justify-center">
        <Link to="/" className="flex items-center justify-center w-full bg-white rounded-xl py-2 px-4 hover:opacity-95 transition-opacity">
          <img src={arkeLogo} alt="ARKE Logo" className="h-10 w-auto object-contain" />
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Navigation</p>
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Avatar url={avatarUrl} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">Educator</p>
          </div>
        </div>
        <LogoutButton onConfirm={onLogout} />
      </div>
    </aside>
  );
});
TeacherSidebar.displayName = "TeacherSidebar";

const TeacherLayout = () => {
  const { user, signOut } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingDoubts, setPendingDoubts] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const displayName = useMemo(() => {
    return (
      storeUser?.full_name?.trim() ||
      (user?.user_metadata?.full_name as string | undefined)?.trim() ||
      user?.email?.split("@")[0] ||
      "Teacher"
    );
  }, [storeUser?.full_name, user?.user_metadata, user?.email]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  useNotifications();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!user) return;
    let ignore = false;
    const load = async () => {
      const { count } = await supabase
        .from("doubts")
        .select("id", { count: "exact", head: true })
        .neq("status", "answered");
      if (!ignore) setPendingDoubts(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("teacher-sidebar-doubts")
      .on("postgres_changes", { event: "*", schema: "public", table: "doubts" }, load)
      .subscribe();
    return () => {
      ignore = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: Home, path: "/teacher/dashboard" },
    { label: "Live Classes", icon: Video, path: "/teacher/live-classes" },
    { label: "Doubt Queue", icon: MessageCircle, path: "/teacher/doubts", badge: pendingDoubts },
    { label: "Settings", icon: Settings, path: "/teacher/settings" },
  ];

  return (
    <div className={`flex min-h-screen bg-background ${drawerOpen ? "overflow-hidden" : ""}`}>
      <TeacherSidebar pendingDoubts={pendingDoubts} displayName={displayName} initials={initials} avatarUrl={storeUser?.avatar_url} onLogout={handleLogout} />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile slide-out drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 bg-card border-r border-border flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-transform duration-300 lg:hidden ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="bg-white rounded-lg py-1.5 px-3 flex items-center justify-center">
            <img src={arkeLogo} alt="ARKE Logo" className="h-8 w-auto object-contain" />
          </div>
          <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Navigation</p>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Avatar url={storeUser?.avatar_url} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">Educator</p>
            </div>
          </div>
          <LogoutButton onConfirm={handleLogout} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-4 py-3 lg:px-6">
          {/* Mobile: hamburger left, logo center, icons right */}
          <div className="flex items-center gap-3 lg:hidden w-full">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex-1 flex justify-center">
              <Link to="/" onClick={() => setDrawerOpen(false)}>
                <div className="bg-white rounded-lg p-1 flex items-center justify-center">
                  <img src={arkeLogo} alt="ARKE Logo" className="h-9 w-auto object-contain" />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <Avatar url={storeUser?.avatar_url} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary" />
            </div>
          </div>
          {/* Desktop: search left, icons right */}
          <div className="hidden lg:flex items-center justify-between w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search doubts, classes..." className="w-64 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Avatar url={storeUser?.avatar_url} initials={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;
