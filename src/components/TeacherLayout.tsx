import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Video, MessageCircle, Settings, Search, LogOut } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  const navItems: NavItem[] = [
    { label: "Home", icon: Home, path: "/teacher/dashboard" },
    { label: "Classes", icon: Video, path: "/teacher/live-classes" },
    { label: "Doubt", icon: MessageCircle, path: "/teacher/doubts", badge: pendingDoubts },
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

/** Mobile bottom nav bar shown on small screens */
const MobileBottomNav = memo(({ navItems, onLogout }: { navItems: NavItem[]; onLogout: () => void }) => {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden bg-card border-t border-border">
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}
      {/* Logout tab */}
      <LogoutButton
        onConfirm={onLogout}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-destructive transition-colors"
        label="Logout"
      />
    </nav>
  );
});
MobileBottomNav.displayName = "MobileBottomNav";

/** Avatar button with a small dropdown showing logout — mobile only */
const MobileUserMenu = ({ initials, avatarUrl, onLogout }: { initials: string; avatarUrl?: string; onLogout: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary overflow-hidden focus:outline-none"
        aria-label="Account menu"
      >
        {avatarUrl
          ? <img src={avatarUrl} alt={initials} className="h-full w-full object-cover" />
          : <span>{initials}</span>
        }
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-border bg-card shadow-lg py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* LogoutButton handles its own confirm dialog */}
          <LogoutButton
            onConfirm={() => { setOpen(false); onLogout(); }}
            variant="compact"
            label="Logout"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

const TeacherLayout = () => {
  const { user, signOut } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const navigate = useNavigate();

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

  const [pendingDoubts, setPendingDoubts] = useState(0);

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
    { label: "Home", icon: Home, path: "/teacher/dashboard" },
    { label: "Classes", icon: Video, path: "/teacher/live-classes" },
    { label: "Doubt", icon: MessageCircle, path: "/teacher/doubts", badge: pendingDoubts },
    { label: "Settings", icon: Settings, path: "/teacher/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <TeacherSidebar
        pendingDoubts={pendingDoubts}
        displayName={displayName}
        initials={initials}
        avatarUrl={storeUser?.avatar_url}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center border-b border-border bg-card px-4 py-3 lg:px-6">
          {/* Mobile header: logo center, notification + avatar(logout) right */}
          <div className="flex items-center lg:hidden w-full">
            <div className="flex-1 flex justify-start">
              <Link to="/">
                <div className="bg-white rounded-lg p-1 flex items-center justify-center">
                  <img src={arkeLogo} alt="ARKE Logo" className="h-9 w-auto object-contain" />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <MobileUserMenu
                initials={initials}
                avatarUrl={storeUser?.avatar_url}
                onLogout={handleLogout}
              />
            </div>
          </div>

          {/* Desktop header: search left, icons right */}
          <div className="hidden lg:flex items-center justify-between w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search doubts, classes..."
                className="w-64 rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Avatar
                url={storeUser?.avatar_url}
                initials={initials}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary"
              />
            </div>
          </div>
        </header>

        {/* pb-16 on mobile so content doesn't hide behind the bottom nav */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav navItems={navItems} onLogout={handleLogout} />
    </div>
  );
};

export default TeacherLayout;
